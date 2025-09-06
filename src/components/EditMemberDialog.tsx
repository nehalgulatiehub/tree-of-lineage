import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Camera } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface FamilyMember {
  id: string;
  name: string;
  gender?: string;
  date_of_birth?: string;
  date_of_death?: string;
  photo_url?: string;
  photo_file_path?: string;
  notes?: string;
  is_alive?: boolean;
}

interface EditMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onMemberUpdated: () => void;
  member: FamilyMember | null;
}

const EditMemberDialog = ({ open, onClose, onMemberUpdated, member }: EditMemberDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    dateOfBirth: "",
    dateOfDeath: "",
    photoUrl: "",
    notes: "",
    isAlive: true,
  });

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name || "",
        gender: member.gender || "",
        dateOfBirth: member.date_of_birth || "",
        dateOfDeath: member.date_of_death || "",
        photoUrl: member.photo_url || "",
        notes: member.notes || "",
        isAlive: member.is_alive !== false,
      });
      setPhotoPreview(null);
      setSelectedPhoto(null);
    }
  }, [member]);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let photoPath = member.photo_file_path;
      
      // Upload new photo if selected
      if (selectedPhoto) {
        const fileExt = selectedPhoto.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('family-photos')
          .upload(filePath, selectedPhoto);
        
        if (uploadError) {
          console.warn("Photo upload failed:", uploadError);
          toast({
            title: "Photo upload failed",
            description: "Member was updated but photo could not be uploaded",
            variant: "destructive",
          });
        } else {
          // Delete old photo if it exists
          if (member.photo_file_path) {
            await supabase.storage
              .from('family-photos')
              .remove([member.photo_file_path]);
          }
          photoPath = filePath;
        }
      }

      const { error } = await supabase
        .from("family_members")
        .update({
          name: formData.name,
          gender: formData.gender || null,
          date_of_birth: formData.dateOfBirth || null,
          date_of_death: formData.dateOfDeath || null,
          photo_url: formData.photoUrl || null,
          photo_file_path: photoPath,
          notes: formData.notes || null,
          is_alive: formData.isAlive,
        })
        .eq("id", member.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Family member updated successfully",
      });

      onMemberUpdated();
      onClose();
    } catch (error) {
      console.error("Error updating family member:", error);
      toast({
        title: "Error",
        description: "Failed to update family member",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentPhoto = () => {
    if (photoPreview) return photoPreview;
    if (member?.photo_file_path) {
      return supabase.storage.from('family-photos').getPublicUrl(member.photo_file_path).data.publicUrl;
    }
    return formData.photoUrl || member?.photo_url;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Family Member</DialogTitle>
          <DialogDescription>
            Update the details for {member?.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo Upload Section */}
          <div className="space-y-2">
            <Label>Profile Photo</Label>
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={getCurrentPhoto() || undefined} />
                <AvatarFallback className="bg-muted">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload">
                  <Button type="button" variant="outline" className="cursor-pointer" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose New Photo
                    </span>
                  </Button>
                </label>
                <div className="text-xs text-muted-foreground">
                  Or update photo URL below
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfDeath">Date of Death</Label>
              <Input
                id="dateOfDeath"
                type="date"
                value={formData.dateOfDeath}
                onChange={(e) => setFormData({ ...formData, dateOfDeath: e.target.value })}
                disabled={formData.isAlive}
              />
            </div>
          </div>

          {/* Living Status */}
          <div className="flex flex-row items-center justify-between rounded-lg border p-3 space-y-0">
            <div className="space-y-0.5">
              <Label>Living Status</Label>
              <div className="text-sm text-muted-foreground">
                Is this person currently alive?
              </div>
            </div>
            <Switch
              checked={formData.isAlive}
              onCheckedChange={(checked) => {
                setFormData({ ...formData, isAlive: checked });
                if (checked) {
                  setFormData(prev => ({ ...prev, dateOfDeath: "" }));
                }
              }}
            />
          </div>


          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional notes about this family member..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditMemberDialog;