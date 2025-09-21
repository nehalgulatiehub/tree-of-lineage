import { EdgeProps, getStraightPath } from '@xyflow/react';

interface FamilyTreeEdgeProps extends EdgeProps {
  data?: {
    type: 'spouse' | 'parent-child';
  };
}

const FamilyTreeEdge = ({ 
  sourceX, 
  sourceY, 
  targetX, 
  targetY, 
  style,
  data 
}: FamilyTreeEdgeProps) => {
  if (data?.type === 'parent-child') {
    // Create T-junction connection for parent-child relationships
    const midX = (sourceX + targetX) / 2;
    const dropY = sourceY + 60; // Drop down from parents
    
    const path = `
      M ${sourceX} ${sourceY}
      L ${midX} ${sourceY}
      L ${midX} ${dropY}
      L ${targetX} ${dropY}
      L ${targetX} ${targetY}
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