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
    let startX = sourceX;
    let startY = sourceY;
    
    // If there's a spouse, calculate midpoint between the couple
    if (data.spouseId) {
      const spouseNode = getNode(data.spouseId);
      if (spouseNode) {
        // Calculate midpoint between parent and spouse
        startX = (sourceX + spouseNode.position.x + 140) / 2; // 140 is half card width
        startY = sourceY; // Keep same Y level as parents
      }
    }
    
    // Create T-junction connection from midpoint of parents to child
    const dropY = startY + 80; // Drop down from parents
    
    const path = `
      M ${startX} ${startY}
      L ${startX} ${dropY}
      L ${targetX + 140} ${dropY}
      L ${targetX + 140} ${targetY}
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