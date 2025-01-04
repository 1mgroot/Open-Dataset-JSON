# Dataset JSON Viewer

A lightweight, modern web application for viewing and analyzing dataset JSON files with an intuitive user interface.

🔗 [Live Demo](https://lightweightdatasetjsonviewer.vercel.app/)

## Features

- 📁 Drag & Drop folder support
- 📊 Interactive data table with:
  - Column sorting (multi-column support)
  - Column visibility toggle
  - Column reordering
  - Pagination
- 🔍 Advanced filtering capabilities
- 📱 Responsive design (mobile & desktop)
- 🎯 Column name/label switching
- 🗂️ Multi-file support within folders

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/1mgroot/Simple_Dataset-JSON_Viewer.git
cd Simple_Dataset-JSON_Viewer
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Loading Data**:
   - Drag and drop a folder containing JSON files
   - Or click to browse and select a folder

2. **Viewing Data**:
   - Switch between files using the tabs
   - Toggle between column names and labels
   - Show/hide columns using the column visibility toggle
   - Sort data by clicking column headers
   - Reorder columns by dragging them

3. **Filtering Data**:
   - Use the filter input to query data
   - Supports complex filtering with AND/OR operators
   - Example: `column1 > 10 and column2 = "value"`

## Built With

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [DND Kit](https://dndkit.com/) - Drag and drop functionality

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Deployment

The application is deployed on [Vercel](https://vercel.com) and can be accessed at [https://lightweightdatasetjsonviewer.vercel.app/](https://lightweightdatasetjsonviewer.vercel.app/)
