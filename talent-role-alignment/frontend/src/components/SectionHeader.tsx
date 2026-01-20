import React from 'react';

type SectionHeaderProps = {
  title: string;
  description?: string;
  extra?: React.ReactNode;
};

export default function SectionHeader({ title, description, extra }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">{title}</h2>
        {description ? <p className="text-sm text-ink-500">{description}</p> : null}
      </div>
      {extra ? <div>{extra}</div> : null}
    </div>
  );
}
