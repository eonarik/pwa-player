// src/components/ui/VirtualGrid.types.ts

export type VirtualGridMode = 'grid' | 'list';

export interface VirtualGridSection<T> {
  title: string;
  items: T[];
}
