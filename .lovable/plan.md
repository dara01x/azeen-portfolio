

# Azeen Real Estate Portal — Implementation Plan

## Design System
- Light theme, clean SaaS aesthetic (inspired by Linear/Stripe)
- Indigo accent color, neutral white/gray base
- Status colors: green (available), red (sold), gray (archived)
- Soft shadows, rounded cards, spacious layout
- Left sidebar navigation with collapsible support, top header bar

## Module Breakdown

### 1. Layout & Navigation
- Sidebar with grouped nav: Properties, Projects, Units, Clients, Users, App Variables, Settings
- Top header with user avatar and app title
- Responsive layout with mobile sidebar trigger

### 2. Properties Module (Core)
- **List page**: Data table with search, filters (city, type, status, listing type), sorting, status badges
- **Create/Edit page**: Multi-section form covering Basic, Pricing, Location (with map lat/lng inputs), Details, Features, Building Info, Descriptions (EN/KU/AR tabs), Media (image upload UI, video URL), Relations, Internal Notes
- **Detail page**: Clean sectioned read-only view with image gallery

### 3. Projects Module
- List with table, status badges, search
- Create/Edit form with all specified fields including image upload UI and map inputs

### 4. Units Module
- List table with project filter, status badges
- Create/Edit form linked to projects

### 5. Clients Module
- List table with search and status filter
- Create/Edit form with all fields

### 6. Users Module
- List table with role/status filters
- Create/Edit form with conditional company fields when role = company

### 7. App Variables (CRUD pages)
- Property Types, Cities, Amenities, Views — each with inline list + add/edit/delete dialogs

### 8. Settings Page
- Toggle switches for company permissions

## Data Approach
- All data stored in React state with mock/sample data
- TypeScript interfaces for every entity
- Clean separation: types, mock data, components, pages
- Ready for future backend integration (all forms use structured state)

## Key UI Components
- Reusable DataTable with search, filters, sorting
- Reusable form sections and field components
- Status badge component with color mapping
- Image upload placeholder component
- Multilingual text input (EN/KU/AR tabs)
- Empty state and loading skeleton patterns

