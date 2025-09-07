
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

  // Enhanced hierarchical family tree layout
  const createNodesAndEdges = useCallback(() => {
    if (familyMembers.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    // Get relationships
    const spouseRelationships = relationships.filter(r => r.relationship_type === 'spouse');
    const parentRelationships = relationships.filter(r => r.relationship_type === 'parent');
    
    // Find root generation (members without parents)
    const childrenIds = new Set(parentRelationships.map(r => r.person2_id));
    const rootMembers = familyMembers.filter(m => !childrenIds.has(m.id));
    
    // Build generations with proper hierarchy
    const generations: Map<number, string[]> = new Map();
    const memberToGeneration: Map<string, number> = new Map();
    const processedMembers = new Set<string>();
    
    // Recursive function to assign generations
    const assignGeneration = (memberId: string, generation: number) => {
      if (memberToGeneration.has(memberId)) return;
      
      memberToGeneration.set(memberId, generation);
      if (!generations.has(generation)) {
        generations.set(generation, []);
      }
      generations.get(generation)!.push(memberId);
      
      // Find children and assign them to next generation
      const children = parentRelationships
        .filter(r => r.person1_id === memberId)
        .map(r => r.person2_id);
      
      children.forEach(childId => {
        assignGeneration(childId, generation + 1);
      });
    };
    
    // Start with root members at generation 0
    rootMembers.forEach(member => assignGeneration(member.id, 0));
    
    // Group spouses together in each generation
    const coupleGroups: Map<number, Array<{type: 'couple' | 'single', members: string[]}>> = new Map();
    
    Array.from(generations.keys()).sort().forEach(gen => {
      const membersInGen = generations.get(gen)!;
      const groups: Array<{type: 'couple' | 'single', members: string[]}> = [];
      const processed = new Set<string>();
      
      membersInGen.forEach(memberId => {
        if (processed.has(memberId)) return;
        
        // Check if this member has a spouse in the same generation
        const spouseRel = spouseRelationships.find(r => {
          const otherId = r.person1_id === memberId ? r.person2_id : r.person1_id;
          return (r.person1_id === memberId || r.person2_id === memberId) && 
                 memberToGeneration.get(otherId) === gen &&
                 !processed.has(otherId);
        });
        
        if (spouseRel) {
          const spouseId = spouseRel.person1_id === memberId ? spouseRel.person2_id : spouseRel.person1_id;
          groups.push({type: 'couple', members: [memberId, spouseId]});
          processed.add(memberId);
          processed.add(spouseId);
        } else {
          groups.push({type: 'single', members: [memberId]});
          processed.add(memberId);
        }
      });
      
      coupleGroups.set(gen, groups);
    });
    
    // Position nodes generation by generation
    let currentY = 80;
    const generationSpacing = 320;
    const nodeWidth = 260;
    const coupleSpacing = 20; // Space between spouses
    const groupSpacing = 150; // Space between different family groups
    
    Array.from(coupleGroups.keys()).sort().forEach(gen => {
      const groups = coupleGroups.get(gen)!;
      
      // Calculate total width needed for this generation
      const totalWidth = groups.reduce((width, group) => {
        if (group.type === 'couple') {
          return width + (nodeWidth * 2) + coupleSpacing + groupSpacing;
        } else {
          return width + nodeWidth + groupSpacing;
        }
      }, 0);
      
      let currentX = Math.max(100, (window.innerWidth - totalWidth) / 2);
      
      groups.forEach(group => {
        if (group.type === 'couple') {
          const [member1Id, member2Id] = group.members;
          const member1 = familyMembers.find(m => m.id === member1Id)!;
          const member2 = familyMembers.find(m => m.id === member2Id)!;
          
          // Position spouses side by side
          newNodes.push({
            id: member1.id,
            type: 'familyMember',
            position: { x: currentX, y: currentY },
            data: member1 as any,
            draggable: true,
          });
          
          newNodes.push({
            id: member2.id,
            type: 'familyMember',
            position: { x: currentX + nodeWidth + coupleSpacing, y: currentY },
            data: member2 as any,
            draggable: true,
          });
          
          // Single horizontal line between spouses
          newEdges.push({
            id: `spouse-${member1.id}-${member2.id}`,
            source: member1.id,
            target: member2.id,
            sourceHandle: 'right',
            targetHandle: 'left',
            type: 'straight',
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 3 },
          });
          
          processedMembers.add(member1.id);
          processedMembers.add(member2.id);
          
          // Handle children connections
          const childrenOfCouple = parentRelationships
            .filter(r => r.person1_id === member1.id || r.person1_id === member2.id)
            .map(r => r.person2_id)
            .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates
          
          if (childrenOfCouple.length > 0) {
            // Create connection point at the center of the spouse line
            const connectionId = `connection-${member1.id}-${member2.id}`;
            const centerX = currentX + (nodeWidth + coupleSpacing) / 2;
            
            newNodes.push({
              id: connectionId,
              type: 'default',
              position: { x: centerX, y: currentY + 120 },
              data: { label: '' },
              style: { opacity: 0, width: 1, height: 1 },
              draggable: false,
            });
            
            // Vertical line down from the couple
            newEdges.push({
              id: `down-${connectionId}`,
              source: member1.id,
              target: connectionId,
              sourceHandle: 'bottom',
              type: 'straight',
              style: { stroke: 'hsl(var(--tree-connection))', strokeWidth: 2 },
            });
            
            // Connect each child to the connection point
            childrenOfCouple.forEach(childId => {
              newEdges.push({
                id: `child-${connectionId}-${childId}`,
                source: connectionId,
                target: childId,
                targetHandle: 'top',
                type: 'straight',
                style: { stroke: 'hsl(var(--tree-connection))', strokeWidth: 2 },
              });
            });
          }
          
          currentX += (nodeWidth * 2) + coupleSpacing + groupSpacing;
          
        } else {
          // Single member
          const memberId = group.members[0];
          const member = familyMembers.find(m => m.id === memberId)!;
          
          newNodes.push({
            id: member.id,
            type: 'familyMember',
            position: { x: currentX, y: currentY },
            data: member as any,
            draggable: true,
          });
          
          processedMembers.add(member.id);
          
          // Handle single parent children
          const children = parentRelationships
            .filter(r => r.person1_id === member.id)
            .map(r => r.person2_id);
          
          children.forEach(childId => {
            newEdges.push({
              id: `single-parent-${member.id}-${childId}`,
              source: member.id,
              target: childId,
              sourceHandle: 'bottom',
              targetHandle: 'top',
              type: 'straight',
              style: { stroke: 'hsl(var(--tree-connection))', strokeWidth: 2 },
            });
          });
          
          currentX += nodeWidth + groupSpacing;
        }
      });
      
      currentY += generationSpacing;
    });
    
    // Add any remaining unprocessed members at the top
    let remainingX = 100;
    familyMembers.forEach((member) => {
      if (!processedMembers.has(member.id)) {
        newNodes.push({
          id: member.id,
          type: 'familyMember',
          position: { x: remainingX, y: 80 },
          data: member as any,
          draggable: true,
        });
        remainingX += nodeWidth + groupSpacing;
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
