import { StallInstance } from "@/hooks/useStallInstances";

interface StallCanvasViewProps {
  stalls: StallInstance[];
  onStallClick: (stall: StallInstance) => void;
  getStallColor: (stall: StallInstance) => string;
}

export const StallCanvasView = ({ stalls, onStallClick, getStallColor }: StallCanvasViewProps) => {
  return (
    <div className="relative bg-muted/20 rounded-lg p-8 min-h-[400px]">
      <svg width="100%" height="350" viewBox="0 0 800 600">
        {stalls.map((stall) => {
          const fillColor = getStallColor(stall);
          const stallPrice = stall.price_override || stall.stall_templates?.price || 0;

          return (
            <g onClick={() => onStallClick(stall)} key={stall.id}>
              <rect
                x={stall.x}
                y={stall.y}
                width={stall.width}
                height={stall.height}
                fill={fillColor}
                stroke="#ffffff"
                strokeWidth="2"
                rx="4"
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
              <text
                x={stall.x + stall.width / 2}
                y={stall.y + stall.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="14"
                fontWeight="bold"
                cursor={"pointer"}
              >
                {stall.label}
              </text>
              <text
                x={stall.x + stall.width / 2}
                y={stall.y + stall.height / 2 + 15}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="10"
                cursor={"pointer"}
              >
                ${stallPrice}/day
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
