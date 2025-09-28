import { EdgeProps, getStraightPath, useReactFlow } from '@xyflow/react';

interface FamilyTreeEdgeProps extends EdgeProps {
  data?: {
    type: 'spouse' | 'parent-child';
    spouseId?: string;
  };
}

const FamilyTreeEdge = ({ 
  source,
  target,
  sourceX, 
  sourceY, 
  targetX, 
  targetY, 
  style,
  data 
}: FamilyTreeEdgeProps) => {
  const { getNode } = useReactFlow();

  if (data?.type === 'parent-child') {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);
    
    if (!sourceNode || !targetNode) return null;
    
    let parentCenterX = sourceNode.position.x + 140; // Center of source card
    let parentY = sourceNode.position.y + sourceNode.height!;
    
    // If there's a spouse, calculate the midpoint between the couple
    if (data.spouseId) {
      const spouseNode = getNode(data.spouseId);
      if (spouseNode) {
        const spouse1CenterX = sourceNode.position.x + 140;
        const spouse2CenterX = spouseNode.position.x + 140;
        parentCenterX = (spouse1CenterX + spouse2CenterX) / 2;
      }
    }
    
    const childCenterX = targetNode.position.x + 140;
    const childY = targetNode.position.y;
    
    // Create proper T-junction: vertical drop from parents, horizontal to child position, then vertical to child
    const verticalDropDistance = 60;
    const intermediateY = parentY + verticalDropDistance;
    
    const path = `
      M ${parentCenterX} ${parentY}
      L ${parentCenterX} ${intermediateY}
      L ${childCenterX} ${intermediateY}
      L ${childCenterX} ${childY}
    `;
    
    return (
      <path
        d={path}
        style={{
          ...style,
          fill: 'none',
        }}
        className="react-flow__edge-path"
      />
    );
  }
  
  // Default straight path for spouse connections
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <path
      d={edgePath}
      style={{
        ...style,
        fill: 'none',
      }}
      className="react-flow__edge-path"
    />
  );
};

export default FamilyTreeEdge;