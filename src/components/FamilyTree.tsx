
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

  // Enhanced family tree layout with proper parent-child connections
  const createNodesAndEdges = useCallback(() => {
    if (familyMembers.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    // Group relationships by type
    const spouseRelationships = relationships.filter(r => r.relationship_type === 'spouse');
    const parentRelationships = relationships.filter(r => r.relationship_type === 'parent');
    
    // Create spouse pair mapping
    const spousePairs = new Map<string, string>();
    spouseRelationships.forEach(rel => {
      spousePairs.set(rel.person1_id, rel.person2_id);
      spousePairs.set(rel.person2_id, rel.person1_id);
    });
    
    // Create parent-child mapping
    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string[]>();
    
    parentRelationships.forEach(rel => {
      // Parent to children
      if (!parentChildMap.has(rel.person1_id)) {
        parentChildMap.set(rel.person1_id, []);
      }
      parentChildMap.get(rel.person1_id)!.push(rel.person2_id);
      
      // Child to parents
      if (!childParentMap.has(rel.person2_id)) {
        childParentMap.set(rel.person2_id, []);
      }
      childParentMap.get(rel.person2_id)!.push(rel.person1_id);
    });

    const processedMembers = new Set<string>();
    let currentX = 0;
    const generationY = { 0: 100, 1: 350, 2: 600 };

    // Process couples and their children
    const processedCouples = new Set<string>();
    
    spouseRelationships.forEach((rel, index) => {
      const coupleKey = [rel.person1_id, rel.person2_id].sort().join('-');
      if (processedCouples.has(coupleKey)) return;
      processedCouples.add(coupleKey);
      
      const spouse1 = familyMembers.find(m => m.id === rel.person1_id);
      const spouse2 = familyMembers.find(m => m.id === rel.person2_id);
      
      if (!spouse1 || !spouse2) return;
      
      const baseX = currentX;
      
      // Position spouses side by side
      newNodes.push({
        id: spouse1.id,
        type: 'familyMember',
        position: { x: baseX, y: generationY[0] },
        data: spouse1 as any,
        draggable: true,
      });
      
      newNodes.push({
        id: spouse2.id,
        type: 'familyMember',
        position: { x: baseX + 300, y: generationY[0] },
        data: spouse2 as any,
        draggable: true,
      });
      
      processedMembers.add(spouse1.id);
      processedMembers.add(spouse2.id);
      
      // Add straight line between spouses
      newEdges.push({
        id: `spouse-${spouse1.id}-${spouse2.id}`,
        source: spouse1.id,
        target: spouse2.id,
        sourceHandle: 'spouse-right',
        targetHandle: 'spouse-left',
        type: 'straight',
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 4 },
        label: '♥',
      });
      
      // Find all children of this couple
      const spouse1Children = parentChildMap.get(spouse1.id) || [];
      const spouse2Children = parentChildMap.get(spouse2.id) || [];
      const allChildren = [...new Set([...spouse1Children, ...spouse2Children])];
      
      if (allChildren.length > 0) {
        // Create connection point between parents
        const connectionId = `connection-${spouse1.id}-${spouse2.id}`;
        const connectionX = baseX + 150; // Center between spouses
        const connectionY = generationY[0] + 100;
        
        newNodes.push({
          id: connectionId,
          type: 'default',
          position: { x: connectionX, y: connectionY },
          data: { label: '' },
          style: { opacity: 0, width: 1, height: 1 },
          draggable: false,
        });
        
        // Connect both parents to the connection point
        newEdges.push({
          id: `parent-line-${spouse1.id}`,
          source: spouse1.id,
          target: connectionId,
          sourceHandle: 'bottom',
          type: 'straight',
          style: { stroke: 'hsl(var(--tree-connection))', strokeWidth: 2 },
        });
        
        newEdges.push({
          id: `parent-line-${spouse2.id}`,
          source: spouse2.id,
          target: connectionId,
          sourceHandle: 'bottom',
          type: 'straight',
          style: { stroke: 'hsl(var(--tree-connection))', strokeWidth: 2 },
        });
        
        // Position children and connect them to the connection point
        allChildren.forEach((childId, childIndex) => {
          const child = familyMembers.find(m => m.id === childId);
          if (!child || processedMembers.has(childId)) return;
          
          const childX = baseX + (childIndex - (allChildren.length - 1) / 2) * 250 + 150;
          
          newNodes.push({
            id: child.id,
            type: 'familyMember',
            position: { x: childX, y: generationY[1] },
            data: child as any,
            draggable: true,
          });
          
          processedMembers.add(childId);
          
          // Connect child to the connection point
          newEdges.push({
            id: `child-${childId}`,
            source: connectionId,
            target: childId,
            targetHandle: 'top',
            type: 'straight',
            style: { stroke: 'hsl(var(--tree-connection))', strokeWidth: 2 },
          });
        });
      }
      
      currentX += Math.max(600, allChildren.length * 250 + 300);
    });
    
    // Add remaining single members
    familyMembers.forEach((member) => {
      if (!processedMembers.has(member.id)) {
        newNodes.push({
          id: member.id,
          type: 'familyMember',
          position: { x: currentX, y: generationY[0] },
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
