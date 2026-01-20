import React from 'react';
import { Card } from 'antd';

type InsightCardProps = {
  label?: string;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
};

export default function InsightCard({
  label,
  title,
  description,
  footer,
  extra,
  className,
}: InsightCardProps) {
  return (
    <Card className={`shadow-card ${className ?? ''}`.trim()}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {label ? <p className="text-xs uppercase tracking-[0.2em] text-ink-500">{label}</p> : null}
          <h3 className="text-xl font-semibold text-ink-900">{title}</h3>
          {description ? <p className="mt-2 text-sm text-ink-700">{description}</p> : null}
        </div>
        {extra ? <div>{extra}</div> : null}
      </div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </Card>
  );
}
