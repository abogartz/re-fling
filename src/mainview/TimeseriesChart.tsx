import { useRef, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { TooltipItem } from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimeseriesChartProps {
  timestamps: number[];
  rpsValues: number[];
}

export function TimeseriesChart({ timestamps, rpsValues }: TimeseriesChartProps) {
  const data = {
    labels: timestamps.map((ts) => `${(ts / 1000).toFixed(1)}s`),
    datasets: [
      {
        label: "RPS",
        data: rpsValues,
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"line">) => `${(context.parsed.y as number).toFixed(2)} RPS`,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Time",
          color: "#9ca3af",
        },
        ticks: {
          maxTicksLimit: 10,
          color: "#9ca3af",
        },
        grid: {
          color: "#374151",
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "RPS",
          color: "#9ca3af",
        },
        ticks: {
          stepSize: 1,
          color: "#9ca3af",
          callback: function(value: number | string) {
            return Math.round(Number(value));
          },
        },
        grid: {
          color: "#374151",
        },
      },
    },
  };

  const chartRef = useRef<Chart | null>(null);

  // Expose chart instance globally for E2E testing
  useEffect(() => {
    if (chartRef.current) {
      const win = window as unknown as Record<string, unknown>;
      win["__chartInstance"] = chartRef.current;
    }
  }, [timestamps, rpsValues]);

  return (
    <div className="w-full h-48" style={{ maxHeight: "150px" }}>
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
}
