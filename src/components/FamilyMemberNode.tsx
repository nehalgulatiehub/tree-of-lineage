import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Calendar } from "lucide-react";

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
}

const FamilyMemberNode = memo(({ data }: FamilyMemberNodeProps) => {
  const getGenderColor = (gender?: string) => {
    switch (gender) {
      case "male":
        return "bg-tree-node-male border-blue-200";
      case "female":
        return "bg-tree-node-female border-pink-200";
      default:
        return "bg-tree-node border-border";
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
      
      <Card className={`min-w-[200px] shadow-soft hover:shadow-medium transition-all duration-200 ${getGenderColor(data.gender)}`}>
        <CardContent className="p-4 text-center space-y-3">
          <div className="flex justify-center">
            <Avatar className="h-16 w-16 border-2 border-background shadow-soft">
              <AvatarImage src={data.photo_url} alt={data.name} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {getInitials(data.name)}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="space-y-1">
            <h3 className="font-semibold text-lg text-foreground">{data.name}</h3>
            
            {data.gender && (
              <Badge variant="secondary" className="text-xs">
                {data.gender.charAt(0).toUpperCase() + data.gender.slice(1)}
              </Badge>
            )}
          </div>
          
          <div className="space-y-1 text-sm text-muted-foreground">
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
            <p className="text-xs text-muted-foreground italic line-clamp-2">
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
    </div>
  );
});

FamilyMemberNode.displayName = "FamilyMemberNode";

export default FamilyMemberNode;