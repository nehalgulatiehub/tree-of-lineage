
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

  // Simple top-to-bottom family tree layout
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
    
    // Build family structure
    const processedMembers = new Set<string>();
    const generations: Array<FamilyMember[]> = [[], [], []]; // Support 3 generations
    
    // Find root generation (members without parents)
    const childrenIds = new Set(parentRelationships.map(r => r.person2_id));
    const rootMembers = familyMembers.filter(m => !childrenIds.has(m.id));
    
    // Place root members in first generation
    let currentX = 100;
    rootMembers.forEach((member, index) => {
      // Check if this member has a spouse
      const spouseRel = spouseRelationships.find(r => r.person1_id === member.id || r.person2_id === member.id);
      let spouse = null;
      
      if (spouseRel) {
        const spouseId = spouseRel.person1_id === member.id ? spouseRel.person2_id : spouseRel.person1_id;
        spouse = familyMembers.find(m => m.id === spouseId);
      }
      
      if (spouse && !processedMembers.has(spouse.id)) {
        // Place couple side by side
        newNodes.push({
          id: member.id,
          type: 'familyMember',
          position: { x: currentX, y: 100 },
          data: member as any,
          draggable: true,
        });
        
        newNodes.push({
          id: spouse.id,
          type: 'familyMember',
          position: { x: currentX + 320, y: 100 },
          data: spouse as any,
          draggable: true,
        });
        
        // Add single spouse line
        newEdges.push({
          id: `spouse-${member.id}-${spouse.id}`,
          source: member.id,
          target: spouse.id,
          sourceHandle: 'spouse-right',
          targetHandle: 'spouse-left',
          type: 'straight',
          style: { stroke: 'hsl(var(--primary))', strokeWidth: 3 },
        });
        
        processedMembers.add(member.id);
        processedMembers.add(spouse.id);
        
        // Find their children
        const childrenOfCouple = parentRelationships
          .filter(r => r.person1_id === member.id || r.person1_id === spouse.id)
          .map(r => r.person2_id);
        
        // Remove duplicates
        const uniqueChildren = [...new Set(childrenOfCouple)];
        
        // Position children below parents
        uniqueChildren.forEach((childId, childIndex) => {
          const child = familyMembers.find(m => m.id === childId);
          if (child && !processedMembers.has(childId)) {
            const childX = currentX + 160 + (childIndex - (uniqueChildren.length - 1) / 2) * 300;
            
            newNodes.push({
              id: child.id,
              type: 'familyMember',
              position: { x: childX, y: 400 },
              data: child as any,
              draggable: true,
            });
            
            processedMembers.add(childId);
            
            // Single line from center of parents to child
            const centerX = currentX + 160;
            const connectionId = `connection-${member.id}-${spouse.id}`;
            
            // Only create connection point once per couple
            if (!newNodes.find(n => n.id === connectionId)) {
              newNodes.push({
                id: connectionId,
                type: 'default',
                position: { x: centerX, y: 250 },
                data: { label: '' },
                style: { opacity: 0, width: 1, height: 1 },
                draggable: false,
              });
              
              // Lines from parents to connection point
              newEdges.push({
                id: `parent-to-center-${member.id}`,
                source: member.id,
                target: connectionId,
                sourceHandle: 'bottom',
                type: 'straight',
                style: { stroke: 'hsl(var(--tree-connection))', strokeWidth: 2 },
              });
              
              newEdges.push({
                id: `parent-to-center-${spouse.id}`,
                source: spouse.id,
                target: connectionId,
                sourceHandle: 'bottom',
                type: 'straight',
                style: { stroke: 'hsl(var(--tree-connection))', strokeWidth: 2 },
              });
            }
            
            // Line from connection point to child
            newEdges.push({
              id: `child-line-${childId}`,
              source: connectionId,
              target: childId,
              targetHandle: 'top',
              type: 'straight',
              style: { stroke: 'hsl(var(--tree-connection))', strokeWidth: 2 },
            });
          }
        });
        
        currentX += Math.max(640, uniqueChildren.length * 300 + 320);
      } else if (!processedMembers.has(member.id)) {
        // Single member
        newNodes.push({
          id: member.id,
          type: 'familyMember',
          position: { x: currentX, y: 100 },
          data: member as any,
          draggable: true,
        });
        
        processedMembers.add(member.id);
        currentX += 350;
      }
    });
    
    // Add any remaining members that weren't processed
    familyMembers.forEach((member) => {
      if (!processedMembers.has(member.id)) {
        newNodes.push({
          id: member.id,
          type: 'familyMember',
          position: { x: currentX, y: 100 },
          data: member as any,
          draggable: true,
        });
        currentX += 350;
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
