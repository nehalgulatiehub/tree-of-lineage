import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Calendar, Edit, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FamilyMemberData {
  id: string;
  name: string;
  gender?: string;
  date_of_birth?: string;
  date_of_death?: string;
  photo_url?: string;
  notes?: string;
}

interface FamilyMemberNodeProps {
  data: FamilyMemberData;
  onEdit?: (member: FamilyMemberData) => void;
  onDelete?: (memberId: string) => void;
}

const FamilyMemberNode = memo(({ data, onEdit, onDelete }: FamilyMemberNodeProps) => {
  const getGenderColor = (gender?: string) => {
    switch (gender) {
      case "male":
        return "bg-blue-600 border-blue-500 text-white";
      case "female":
        return "bg-pink-600 border-pink-500 text-white";
      default:
        return "bg-gray-700 border-gray-600 text-white";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).getFullYear();
    } catch {
      return null;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="group">
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-tree-connection !border-tree-connection"
      />
      
      <Card className={`w-[280px] h-[200px] shadow-soft hover:shadow-medium transition-all duration-200 ${getGenderColor(data.gender)} relative`}>
        <CardContent className="p-4 text-center space-y-3">
          {/* Status dot */}
          <div className="absolute top-2 left-2">
            <div className={`w-3 h-3 rounded-full ${data.date_of_death ? 'bg-red-500' : 'bg-green-500'}`} />
          </div>
          
          {/* Action Menu */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(data)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete?.(data.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex justify-center">
            <Avatar className="h-16 w-16 border-2 border-background shadow-soft">
              <AvatarImage 
                src={data.photo_url || undefined} 
                alt={data.name}
                onError={(e) => {
                  console.log("Image failed to load:", data.photo_url);
                  e.currentTarget.style.display = 'none';
                }}
                onLoad={() => {
                  console.log("Image loaded successfully:", data.photo_url);
                }}
              />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {getInitials(data.name)}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">{data.name}</h3>
            
            {data.gender && (
              <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                {data.gender.charAt(0).toUpperCase() + data.gender.slice(1)}
              </Badge>
            )}
          </div>
          
          <div className="space-y-1 text-sm text-white/80">
            {data.date_of_birth && (
              <div className="flex items-center justify-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>Born {formatDate(data.date_of_birth)}</span>
              </div>
            )}
            
            {data.date_of_death && (
              <div className="flex items-center justify-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>Died {formatDate(data.date_of_death)}</span>
              </div>
            )}
          </div>
          
          {data.notes && (
            <p className="text-xs text-white/70 italic line-clamp-2">
              {data.notes}
            </p>
          )}
        </CardContent>
      </Card>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-tree-connection !border-tree-connection"
      />
      
      {/* Side handles for spouse connections */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!bg-tree-connection !border-tree-connection"
        id="spouse-left"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!bg-tree-connection !border-tree-connection"
        id="spouse-right"
      />
    </div>
  );
});

FamilyMemberNode.displayName = "FamilyMemberNode";

export default FamilyMemberNode;