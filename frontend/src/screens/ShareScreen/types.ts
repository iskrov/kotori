export type Period = 'daily' | 'weekly' | 'monthly';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  is_active?: boolean;
  is_preset?: boolean;
  language_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShareScreenState {
  period: Period;
  selectedTemplate: string | null;
  dateRange: DateRange | undefined;
  isLoading: boolean;
  error: string | null;
}

export interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
}

export interface TemplateListProps {
  selectedId: string | null;
  onSelect: (templateId: string) => void;
  templates?: Template[];
  isLoading?: boolean;
}

export interface TemplateSelectorProps {
  selectedId: string | null;
  onSelect: (templateId: string) => void;
  onError?: (error: string) => void;
}

export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'text';
  style?: any;
}
