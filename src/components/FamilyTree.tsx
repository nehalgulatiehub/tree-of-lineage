
import { useCallback, useEffect, useState, useMemo } from "react";
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

  // Enhanced hierarchical tree layout algorithm
  const createNodesAndEdges = useCallback(() => {
    if (familyMembers.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Build relationship maps for easier lookup
    const spouseMap = new Map<string, string>();
    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string>();

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

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const processedMembers = new Set<string>();

    // Find root members (those without parents) - oldest generation
    const rootMembers = familyMembers.filter(m => !childParentMap.has(m.id));
    const startingMembers = rootMembers.length > 0 ? rootMembers : [familyMembers[0]];

    // Calculate tree structure
    const generations: Map<number, FamilyMember[]> = new Map();
    const memberGeneration = new Map<string, number>();

    // Assign generations starting from root
    const assignGeneration = (members: FamilyMember[], generation: number) => {
      if (!generations.has(generation)) {
        generations.set(generation, []);
      }
      
      members.forEach(member => {
        if (!memberGeneration.has(member.id)) {
          memberGeneration.set(member.id, generation);
          generations.get(generation)!.push(member);
          
          // Find children and assign them to next generation
          const children = parentChildMap.get(member.id) || [];
          const childMembers = children
            .map(childId => familyMembers.find(m => m.id === childId))
            .filter(Boolean) as FamilyMember[];
          
          if (childMembers.length > 0) {
            assignGeneration(childMembers, generation + 1);
          }
        }
      });
    };

    assignGeneration(startingMembers, 0);

    // Add any unprocessed members as orphaned
    familyMembers.forEach(member => {
      if (!memberGeneration.has(member.id)) {
        const maxGen = Math.max(...Array.from(generations.keys()));
        const orphanGen = maxGen + 1;
        if (!generations.has(orphanGen)) {
          generations.set(orphanGen, []);
        }
        generations.get(orphanGen)!.push(member);
        memberGeneration.set(member.id, orphanGen);
      }
    });

    // Layout nodes by generation
    const nodeWidth = 220;
    const nodeHeight = 180;
    const horizontalSpacing = 280;
    const verticalSpacing = 250;
    const spouseOffset = 250;

    Array.from(generations.keys()).sort().forEach(generation => {
      const membersInGen = generations.get(generation) || [];
      const yPosition = 100 + generation * verticalSpacing;
      
      // Group by spouse pairs
      const processed = new Set<string>();
      let xOffset = 50;
      
      membersInGen.forEach(member => {
        if (processed.has(member.id)) return;
        
        const spouseId = spouseMap.get(member.id);
        const spouse = spouseId ? familyMembers.find(m => m.id === spouseId) : null;
        
        // Position primary member
        newNodes.push({
          id: member.id,
          type: "familyMember",
          position: { x: xOffset, y: yPosition },
          data: member as any,
        });
        processed.add(member.id);
        
        // Position spouse next to primary member if exists
        if (spouse && memberGeneration.get(spouse.id) === generation) {
          newNodes.push({
            id: spouse.id,
            type: "familyMember", 
            position: { x: xOffset + spouseOffset, y: yPosition },
            data: spouse as any,
          });
          processed.add(spouse.id);
          
          // Add spouse edge
          newEdges.push({
            id: `spouse-${member.id}-${spouse.id}`,
            source: member.id,
            target: spouse.id,
            type: "straight",
            style: {
              stroke: "hsl(var(--primary))",
              strokeWidth: 3,
            },
            label: "♥",
          });
          
          xOffset += spouseOffset + horizontalSpacing;
        } else {
          xOffset += horizontalSpacing;
        }
      });
    });

    // Add parent-child edges
    relationships.forEach(rel => {
      if (rel.relationship_type === 'parent') {
        newEdges.push({
          id: `parent-${rel.person1_id}-${rel.person2_id}`,
          source: rel.person1_id,
          target: rel.person2_id,
          type: "smoothstep",
          style: {
            stroke: "hsl(var(--tree-connection))",
            strokeWidth: 2,
          },
          animated: false,
        });
      } else if (rel.relationship_type === 'child') {
        newEdges.push({
          id: `child-${rel.person1_id}-${rel.person2_id}`,
          source: rel.person2_id,
          target: rel.person1_id,
          type: "smoothstep", 
          style: {
            stroke: "hsl(var(--tree-connection))",
            strokeWidth: 2,
          },
          animated: false,
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [familyMembers, relationships]);

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

  const nodeTypes = useMemo(() => ({
    familyMember: (props: any) => (
      <FamilyMemberNode 
        {...props} 
        onEdit={handleEditMember}
        onDelete={handleDeleteMember}
      />
    ),
  }), [handleEditMember, handleDeleteMember]);

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
