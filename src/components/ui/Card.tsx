import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  children?: React.ReactNode;
}

export function Card({ title, children, className = "", ...props }: CardProps) {
  return (
    <div className={`bg-[#252525] rounded-lg border border-gray-700 p-2 mb-2 ${className}`} {...props}>
      <h2 className="text-xs font-semibold mb-1 text-white">{title}</h2>
      {children}
    </div>
  );
}
