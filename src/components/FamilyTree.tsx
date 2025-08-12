
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
    console.log("Fetching family data...");
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

      console.log("Fetched members:", members);
      console.log("Fetched relationships:", relations);

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

  // Simplified layout algorithm that ensures all members are displayed
  const createNodesAndEdges = useCallback(() => {
    console.log("Creating nodes and edges...");
    console.log("Family members:", familyMembers);
    console.log("Relationships:", relationships);

    if (familyMembers.length === 0) {
      console.log("No family members found");
      setNodes([]);
      setEdges([]);
      return;
    }

    // Build relationship maps for easier lookup
    const spouseMap = new Map<string, string>();
    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string>();

    relationships.forEach(rel => {
      console.log("Processing relationship:", rel);
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

    console.log("Spouse map:", spouseMap);
    console.log("Parent-child map:", parentChildMap);
    console.log("Child-parent map:", childParentMap);

    const newNodes: Node[] = [];
    const processedMembers = new Set<string>();

    // Find root members (those without parents)
    const rootMembers = familyMembers.filter(m => !childParentMap.has(m.id));
    console.log("Root members:", rootMembers);

    // If no root members found, treat the first member as root
    const startingMembers = rootMembers.length > 0 ? rootMembers : [familyMembers[0]];

    let currentY = 100;
    const nodeSpacing = 350;
    const levelSpacing = 250;

    // Process members level by level
    const processLevel = (members: FamilyMember[], yPosition: number) => {
      let currentX = 100;
      const nextLevelMembers: FamilyMember[] = [];

      members.forEach(member => {
        if (processedMembers.has(member.id)) return;

        // Add the main member
        console.log("Adding node for member:", member.name);
        newNodes.push({
          id: member.id,
          type: "familyMember",
          position: { x: currentX, y: yPosition },
          data: member as any,
        });
        processedMembers.add(member.id);

        // Check for spouse
        const spouseId = spouseMap.get(member.id);
        if (spouseId && !processedMembers.has(spouseId)) {
          const spouse = familyMembers.find(m => m.id === spouseId);
          if (spouse) {
            console.log("Adding spouse node for:", spouse.name);
            newNodes.push({
              id: spouse.id,
              type: "familyMember",
              position: { x: currentX + 250, y: yPosition },
              data: spouse as any,
            });
            processedMembers.add(spouse.id);
          }
        }

        // Find children of this member
        const children = parentChildMap.get(member.id) || [];
        children.forEach(childId => {
          const child = familyMembers.find(m => m.id === childId);
          if (child && !processedMembers.has(childId)) {
            nextLevelMembers.push(child);
          }
        });

        // Also check if spouse has children
        if (spouseId) {
          const spouseChildren = parentChildMap.get(spouseId) || [];
          spouseChildren.forEach(childId => {
            const child = familyMembers.find(m => m.id === childId);
            if (child && !processedMembers.has(childId) && !nextLevelMembers.includes(child)) {
              nextLevelMembers.push(child);
            }
          });
        }

        currentX += spouseId ? 600 : nodeSpacing;
      });

      // Process next level if there are children
      if (nextLevelMembers.length > 0) {
        processLevel(nextLevelMembers, yPosition + levelSpacing);
      }
    };

    // Start processing from root members
    processLevel(startingMembers, currentY);

    // Add any remaining members that weren't processed (orphaned members)
    familyMembers.forEach((member, index) => {
      if (!processedMembers.has(member.id)) {
        console.log("Adding orphaned member:", member.name);
        newNodes.push({
          id: member.id,
          type: "familyMember",
          position: { 
            x: (index % 3) * nodeSpacing + 100, 
            y: currentY + levelSpacing * 2
          },
          data: member as any,
        });
      }
    });

    // Create edges for relationships
    const newEdges: Edge[] = relationships.map((rel, index) => {
      const baseEdge = {
        id: rel.id || `edge-${index}`,
        style: {
          stroke: "hsl(var(--tree-connection))",
          strokeWidth: 2,
        },
      };

      if (rel.relationship_type === 'spouse') {
        return {
          ...baseEdge,
          source: rel.person1_id,
          target: rel.person2_id,
          type: "straight",
          label: "Spouse",
          style: { 
            ...baseEdge.style, 
            stroke: "hsl(var(--primary))" 
          },
        };
      }

      // Parent-child relationships
      return {
        ...baseEdge,
        source: rel.relationship_type === 'parent' ? rel.person1_id : rel.person2_id,
        target: rel.relationship_type === 'parent' ? rel.person2_id : rel.person1_id,
        type: "smoothstep",
        label: "Child",
      };
    });

    console.log("Created nodes:", newNodes);
    console.log("Created edges:", newEdges);

    setNodes(newNodes);
    setEdges(newEdges);
  }, [familyMembers, relationships, handleEditMember, handleDeleteMember]);

  useEffect(() => {
    fetchFamilyData();
  }, []);

  useEffect(() => {
    createNodesAndEdges();
  }, [createNodesAndEdges]);

  const handleMemberAdded = () => {
    console.log("Member added, refreshing data...");
    fetchFamilyData();
    setIsAddDialogOpen(false);
  };

  const handleMemberUpdated = () => {
    console.log("Member updated, refreshing data...");
    fetchFamilyData();
  };

  const nodeTypes = {
    familyMember: (props: any) => (
      <FamilyMemberNode 
        {...props} 
        onEdit={handleEditMember}
        onDelete={handleDeleteMember}
      />
    ),
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
        onMemberUpdated={handleMemberUpdated}
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
