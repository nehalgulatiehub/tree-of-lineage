import { useState } from "react";
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

interface AddMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onMemberAdded: () => void;
  existingMembers: FamilyMember[];
}

const AddMemberDialog = ({ open, onClose, onMemberAdded, existingMembers }: AddMemberDialogProps) => {
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
    relatedTo: "",
    relationshipType: "",
  });

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
    setIsLoading(true);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      let photoPath = null;
      
      // Upload photo if selected
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
            description: "Member was added but photo could not be uploaded",
            variant: "destructive",
          });
        } else {
          photoPath = filePath;
        }
      }

      // Insert family member
      const { data: member, error: memberError } = await supabase
        .from("family_members")
        .insert({
          user_id: user.id,
          name: formData.name,
          gender: formData.gender || null,
          date_of_birth: formData.dateOfBirth || null,
          date_of_death: formData.dateOfDeath || null,
          photo_url: formData.photoUrl || null,
          photo_file_path: photoPath,
          notes: formData.notes || null,
          is_alive: formData.isAlive,
        })
        .select()
        .single();

      if (memberError) {
        console.error("Member insert error:", memberError);
        throw memberError;
      }

      // Add relationship if specified
      if (formData.relatedTo && formData.relationshipType && member) {
        let person1_id = formData.relatedTo;
        let person2_id = member.id;
        let relationship_type = formData.relationshipType;

        // Handle different relationship types properly
        if (formData.relationshipType === "child") {
          // New member is a child of the selected person
          person1_id = formData.relatedTo; // parent
          person2_id = member.id; // child
          relationship_type = "parent"; // parent relationship from parent to child
        } else if (formData.relationshipType === "parent") {
          // New member is a parent of the selected person
          person1_id = member.id; // parent (new member)
          person2_id = formData.relatedTo; // child (existing member)
          relationship_type = "parent"; // parent relationship from new member to existing
        } else if (formData.relationshipType === "spouse") {
          // Spouse relationship is bidirectional
          person1_id = formData.relatedTo;
          person2_id = member.id;
          relationship_type = "spouse";
        } else if (formData.relationshipType === "sibling") {
          // Sibling relationship - we'll store as sibling type
          person1_id = formData.relatedTo;
          person2_id = member.id;
          relationship_type = "sibling";
        }

        const { error: relationError } = await supabase
          .from("family_relationships")
          .insert({
            user_id: user.id,
            person1_id,
            person2_id,
            relationship_type,
          });

        if (relationError) {
          console.error("Error creating relationship:", relationError);
          // Don't throw here, member was created successfully
        } else {
          console.log(`Created ${relationship_type} relationship between ${person1_id} and ${person2_id}`);
        }
      }

      console.log("Member added successfully:", member);
      
      toast({
        title: "Success!",
        description: "Family member added successfully",
      });

      // Reset form
      setFormData({
        name: "",
        gender: "",
        dateOfBirth: "",
        dateOfDeath: "",
        photoUrl: "",
        notes: "",
        isAlive: true,
        relatedTo: "",
        relationshipType: "",
      });
      setSelectedPhoto(null);
      setPhotoPreview(null);

      onMemberAdded();
    } catch (error) {
      console.error("Error adding family member:", error);
      console.log("Full error details:", error);
      toast({
        title: "Error",
        description: "Failed to add family member",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Family Member</DialogTitle>
          <DialogDescription>
            Add a new member to your family tree with their details and relationships.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo Upload Section */}
          <div className="space-y-2">
            <Label>Profile Photo</Label>
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={photoPreview || formData.photoUrl || undefined} />
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
                      Choose Photo
                    </span>
                  </Button>
                </label>
                <div className="text-xs text-muted-foreground">
                  Or enter photo URL below
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
            <Label htmlFor="photoUrl">Photo URL (Optional)</Label>
            <Input
              id="photoUrl"
              type="url"
              value={formData.photoUrl}
              onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
              placeholder="https://example.com/photo.jpg"
            />
          </div>

          {existingMembers.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Relationship (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="relatedTo">Select Existing Family Member</Label>
                  <Select value={formData.relatedTo} onValueChange={(value) => setFormData({ ...formData, relatedTo: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a family member" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} {member.gender && `(${member.gender})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relationshipType">How is this person related?</Label>
                  <Select 
                    value={formData.relationshipType} 
                    onValueChange={(value) => setFormData({ ...formData, relationshipType: value })}
                    disabled={!formData.relatedTo}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">
                        <div className="flex flex-col">
                          <span>Parent</span>
                          <span className="text-xs text-muted-foreground">This person is a parent of the selected member</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="child">
                        <div className="flex flex-col">
                          <span>Child</span>
                          <span className="text-xs text-muted-foreground">This person is a child of the selected member</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="spouse">
                        <div className="flex flex-col">
                          <span>Spouse</span>
                          <span className="text-xs text-muted-foreground">This person is married to the selected member</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="sibling">
                        <div className="flex flex-col">
                          <span>Sibling</span>
                          <span className="text-xs text-muted-foreground">This person is a sibling of the selected member</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {formData.relatedTo && formData.relationshipType && (
                <div className="mt-3 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>{formData.name || "New member"}</strong> will be added as a{" "}
                    <strong>{formData.relationshipType}</strong> of{" "}
                    <strong>{existingMembers.find(m => m.id === formData.relatedTo)?.name}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

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
              {isLoading ? "Adding..." : "Add Member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddMemberDialog;