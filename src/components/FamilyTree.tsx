import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Background,
  Controls,
  MiniMap,
  OnConnect,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import FamilyMemberNode from "./FamilyMemberNode";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AddMemberDialog from "./AddMemberDialog";
import EditMemberDialog from "./EditMemberDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  gender?: string;
  date_of_birth?: string;
  date_of_death?: string;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface FamilyRelationship {
  id: string;
  user_id: string;
  person1_id: string;
  person2_id: string;
  relationship_type: string;
  created_at: string;
}

const nodeTypes = {
  familyMember: FamilyMemberNode,
};

const FamilyTree = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [relationships, setRelationships] = useState<FamilyRelationship[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const onConnect: OnConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const fetchFamilyData = async () => {
    try {
      // Fetch family members
      const { data: members, error: membersError } = await supabase
        .from("family_members")
        .select("*")
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;

      // Fetch relationships
      const { data: relations, error: relationsError } = await supabase
        .from("family_relationships")
        .select("*");

      if (relationsError) throw relationsError;

      setFamilyMembers(members || []);
      setRelationships(relations || []);
    } catch (error) {
      console.error("Error fetching family data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch family data",
        variant: "destructive",
      });
    }
  };

  // Enhanced layout algorithm for family tree structure
  const createNodesAndEdges = useCallback(() => {
    if (familyMembers.length === 0) return;

    // Build family structure
    const memberMap = new Map(familyMembers.map(m => [m.id, m]));
    const spouseMap = new Map<string, string>();
    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string>();
    
    // Process relationships
    relationships.forEach(rel => {
      if (rel.relationship_type === 'spouse') {
        spouseMap.set(rel.person1_id, rel.person2_id);
        spouseMap.set(rel.person2_id, rel.person1_id);
      } else if (rel.relationship_type === 'parent') {
        if (!parentChildMap.has(rel.person1_id)) {
          parentChildMap.set(rel.person1_id, []);
        }
        parentChildMap.get(rel.person1_id)!.push(rel.person2_id);
        childParentMap.set(rel.person2_id, rel.person1_id);
      } else if (rel.relationship_type === 'child') {
        if (!parentChildMap.has(rel.person2_id)) {
          parentChildMap.set(rel.person2_id, []);
        }
        parentChildMap.get(rel.person2_id)!.push(rel.person1_id);
        childParentMap.set(rel.person1_id, rel.person2_id);
      }
    });

    // Find root members (those without parents)
    const rootMembers = familyMembers.filter(m => !childParentMap.has(m.id));
    
    const newNodes: Node[] = [];
    const processedMembers = new Set<string>();
    let currentY = 100;
    
    // Layout generation levels
    const layoutGeneration = (members: FamilyMember[], y: number) => {
      let currentX = 100;
      const generationMembers: string[] = [];
      
      members.forEach(member => {
        if (processedMembers.has(member.id)) return;
        
        // Add main member
        newNodes.push({
          id: member.id,
          type: "familyMember",
          position: { x: currentX, y },
          data: { 
            ...member,
            onEdit: handleEditMember,
            onDelete: handleDeleteMember
          } as unknown as Record<string, unknown>,
        });
        processedMembers.add(member.id);
        generationMembers.push(member.id);
        
        // Add spouse alongside
        const spouseId = spouseMap.get(member.id);
        if (spouseId && !processedMembers.has(spouseId)) {
          const spouse = memberMap.get(spouseId);
          if (spouse) {
            newNodes.push({
              id: spouse.id,
              type: "familyMember",
              position: { x: currentX + 250, y },
              data: { 
                ...spouse,
                onEdit: handleEditMember,
                onDelete: handleDeleteMember
              } as unknown as Record<string, unknown>,
            });
            processedMembers.add(spouse.id);
            generationMembers.push(spouse.id);
          }
        }
        
        currentX += spouseId ? 600 : 350;
      });
      
      // Process children of this generation
      const nextGeneration: FamilyMember[] = [];
      generationMembers.forEach(memberId => {
        const children = parentChildMap.get(memberId) || [];
        children.forEach(childId => {
          const child = memberMap.get(childId);
          if (child && !processedMembers.has(childId)) {
            nextGeneration.push(child);
          }
        });
      });
      
      if (nextGeneration.length > 0) {
        layoutGeneration(nextGeneration, y + 250);
      }
    };
    
    // Start with root members
    if (rootMembers.length > 0) {
      layoutGeneration(rootMembers, currentY);
    } else if (familyMembers.length > 0) {
      // Fallback: simple grid layout
      familyMembers.forEach((member, index) => {
        if (!processedMembers.has(member.id)) {
          newNodes.push({
            id: member.id,
            type: "familyMember",
            position: { 
              x: (index % 3) * 350 + 100, 
              y: Math.floor(index / 3) * 250 + 100 
            },
            data: { 
              ...member,
              onEdit: handleEditMember,
              onDelete: handleDeleteMember
            } as unknown as Record<string, unknown>,
          });
        }
      });
    }

    // Create edges with improved styling
    const newEdges: Edge[] = relationships.map((rel) => {
      const edgeStyle = {
        stroke: "hsl(var(--tree-connection))",
        strokeWidth: 2,
      };
      
      if (rel.relationship_type === 'spouse') {
        return {
          id: rel.id,
          source: rel.person1_id,
          target: rel.person2_id,
          sourceHandle: "spouse-right",
          targetHandle: "spouse-left",
          type: "straight",
          label: "Spouse",
          style: { ...edgeStyle, stroke: "hsl(var(--primary))" },
        };
      }
      
      return {
        id: rel.id,
        source: rel.relationship_type === 'parent' ? rel.person1_id : rel.person2_id,
        target: rel.relationship_type === 'parent' ? rel.person2_id : rel.person1_id,
        type: "smoothstep",
        label: rel.relationship_type === 'parent' || rel.relationship_type === 'child' ? 'Child' : rel.relationship_type,
        style: edgeStyle,
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [familyMembers, relationships, setNodes, setEdges]);

  useEffect(() => {
    fetchFamilyData();
  }, []);

  useEffect(() => {
    createNodesAndEdges();
  }, [createNodesAndEdges]);

  const handleMemberAdded = () => {
    fetchFamilyData();
    setIsAddDialogOpen(false);
  };

  const handleEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setIsEditDialogOpen(true);
  };

  const handleDeleteMember = (memberId: string) => {
    setMemberToDelete(memberId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;
    
    try {
      // Delete relationships first
      await supabase
        .from("family_relationships")
        .delete()
        .or(`person1_id.eq.${memberToDelete},person2_id.eq.${memberToDelete}`);
      
      // Delete the member
      const { error } = await supabase
        .from("family_members")
        .delete()
        .eq("id", memberToDelete);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Family member deleted successfully",
      });

      fetchFamilyData();
    } catch (error) {
      console.error("Error deleting family member:", error);
      toast({
        title: "Error",
        description: "Failed to delete family member",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setMemberToDelete(null);
    }
  };

  return (
    <div className="h-screen w-full relative">
      <div className="absolute top-4 left-4 z-10">
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="shadow-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Family Member
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gradient-to-br from-primary-lighter to-background"
      >
        <Controls className="bg-card shadow-medium rounded-lg" />
        <MiniMap 
          className="bg-card shadow-medium rounded-lg" 
          nodeColor="hsl(var(--primary))"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </ReactFlow>

      <AddMemberDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onMemberAdded={handleMemberAdded}
        existingMembers={familyMembers}
      />

      <EditMemberDialog
        open={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedMember(null);
        }}
        onMemberUpdated={fetchFamilyData}
        member={selectedMember}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Family Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this family member? This action cannot be undone and will also remove all relationships associated with this member.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FamilyTree;