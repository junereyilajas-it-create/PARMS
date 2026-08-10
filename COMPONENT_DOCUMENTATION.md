# Assessor Pro AI - Modular Components Documentation

## Overview

This document describes the modular component architecture for the Assessor Pro AI system. The application now includes modern, reusable components for charts, tables, filters, and complete page templates.

## Component Structure

```
src/components/
├── charts/
│   ├── BarChartComponent.tsx      # Recharts bar chart wrapper
│   ├── DonutChartComponent.tsx    # Recharts donut/pie chart wrapper
│   └── LineChartComponent.tsx     # Recharts line chart wrapper
├── common/
│   ├── MetricCard.tsx             # Statistics card component
│   ├── FilterBar.tsx              # Reusable filter component
│   └── DataTable.tsx              # Pagination-enabled data table
└── pages/
    ├── LandingPage.tsx            # Marketing landing page
    ├── PropertyLotManagement.tsx  # Lot registry with filters
    ├── PropertyOwnershipTransfer.tsx # Workflow-based transfer form
    ├── AiPropertyValuation.tsx    # AI valuation dossier with charts
    ├── BuildingDirectory.tsx      # Building registry with trends
    └── OperationalIntelligenceReports.tsx # Dashboard with analytics
```

## Chart Components

### BarChartComponent
Renders interactive bar charts with multiple data series.

**Props:**
```typescript
interface BarChartProps {
  data: any[];
  title: string;
  xAxisKey: string;
  bars: Array<{ key: string; fill: string; name: string }>;
  height?: number;
}
```

**Example Usage:**
```tsx
<BarChartComponent
  data={[{ month: 'JAN', value: 1000 }, { month: 'FEB', value: 1200 }]}
  title="Monthly Revenue"
  xAxisKey="month"
  bars={[{ key: 'value', fill: '#16a34a', name: 'Revenue' }]}
  height={300}
/>
```

### DonutChartComponent
Renders donut/pie charts for categorical data distribution.

**Props:**
```typescript
interface DonutChartProps {
  data: any[];
  title: string;
  colors: string[];
  height?: number;
}
```

### LineChartComponent
Renders line charts for trend analysis.

**Props:**
```typescript
interface LineChartProps {
  data: any[];
  title: string;
  xAxisKey: string;
  lines: Array<{ key: string; stroke: string; name: string }>;
  height?: number;
}
```

## Common Components

### MetricCard
Displays key metrics with optional trend indicators.

**Props:**
```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: { value: number; isPositive: boolean; label: string };
  icon?: React.ReactNode;
  className?: string;
}
```

**Example:**
```tsx
<MetricCard
  title="Total Properties"
  value="12,482"
  trend={{ value: 1.3, isPositive: true, label: 'this quarter' }}
/>
```

### FilterBar
Provides dropdown filters and search functionality.

**Props:**
```typescript
interface FilterBarProps {
  filters: FilterOption[];
  onFilterChange: (filterName: string, value: string) => void;
  onReset: () => void;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}
```

### DataTable
Responsive table with pagination, sorting, and action buttons.

**Props:**
```typescript
interface DataTableProps {
  columns: Column[];
  data: any[];
  onView?: (row: any) => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  showActions?: boolean;
}
```

## Page Components

### LandingPage
Marketing homepage with features, stats, and call-to-action sections.

### PropertyLotManagement
- Displays 152+ registered lots
- Filterable by district, classification, status
- Bulk export/print options
- Action buttons for view/edit/delete

### PropertyOwnershipTransfer
- Multi-step workflow interface (4 steps)
- Current ownership information display
- Transfer details form
- File upload for supporting documents
- AI policy compliance check
- Workflow guidelines

### AiPropertyValuation
- Estimated market value display with confidence score
- Price index comparison chart
- GIS parcel view map
- Market trends, infrastructure, asset quality insights
- AI market pulse indicator
- Comparable properties table

### BuildingDirectory
- 12,482+ structure registry
- Key metrics (residential units, commercial lots, pending valuations)
- Construction trends chart by district
- AI insights with risk report generation

### OperationalIntelligenceReports
- AI prediction accuracy chart
- Property inventory donut chart
- Tax collection estimates
- User activity logs
- Detailed report inventory table
- Export to PDF/Excel

## Styling

All components use Tailwind CSS for styling. The design system includes:

- **Colors:** Green (#16a34a, #15803d), Gray (#1f2937, #6b7280)
- **Spacing:** Standard Tailwind scale (4px units)
- **Shadows:** Consistent rounded cards with shadows
- **Typography:** Lucide icons (18-20px) with font-semibold titles

## View Modes

The application supports two view modes:

1. **Classic Mode** - Original sidebar navigation with dashboard
2. **Modern Mode** - Modular pages with modern UI (toggle at bottom-right)

## Usage

### Importing Components

```typescript
import {
  BarChartComponent,
  DonutChartComponent,
  LineChartComponent,
  MetricCard,
  FilterBar,
  DataTable,
  PropertyLotManagement,
  PropertyOwnershipTransfer,
  AiPropertyValuation,
  BuildingDirectory,
  OperationalIntelligenceReports,
  LandingPage,
} from './components';
```

### Adding a New Page

1. Create component in `src/components/pages/YourPage.tsx`
2. Export from `src/components/index.ts`
3. Add navigation option in `AppSidebar.tsx`
4. Add conditional render in `App.tsx`

## Dependencies

- **react** ^19.2.7 - UI library
- **react-router-dom** ^7.18.2 - Routing
- **recharts** ^2.10.x - Chart library
- **lucide-react** ^1.27.0 - Icon library
- **tailwindcss** - CSS framework (implicit from existing setup)

## Data Mock

All pages use mock data for demonstration. To connect to real data:

1. Replace mock arrays with API calls
2. Use `useState` hooks for data management
3. Integrate with backend API endpoints

## Accessibility

- Semantic HTML elements
- Proper button and form labeling
- Keyboard navigation support
- ARIA labels where appropriate

## Performance Considerations

- Charts use ResponsiveContainer for automatic sizing
- Pagination built into DataTable
- Lazy loading can be added to routes
- Chart rendering optimized with memoization

---

**Last Updated:** 2024-08-10
