import React from 'react';
import SectionHeader from '@/components/SectionHeader';
import ChoiceCard from '@/components/ChoiceCard';
import { PLATFORM_CHOICES } from './platformChoices';

export default function AccountsEmptyState({ onChoose }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Choose what to connect" />
      <div role="list" className="grid grid-cols-1 gap-x-3 gap-y-5 md:grid-cols-3">
        {PLATFORM_CHOICES.map(choice => (
          <div role="listitem" key={choice.value}>
            <ChoiceCard
              icon={<choice.Icon />}
              title={choice.title}
              description={choice.description}
              onSelect={() => onChoose(choice.value)}
              className="h-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
