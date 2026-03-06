import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function SearchInput({ className = '', ...props }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
      <input
        type="search"
        className="w-full pl-10 pr-4 py-2 rounded-lg border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
        {...props}
      />
    </div>
  );
}
