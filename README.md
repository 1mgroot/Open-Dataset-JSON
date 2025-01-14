# Open Dataset-JSON

A modern, high-performance web application for viewing and analyzing Dataset-JSON files. Built with Next.js and TypeScript, featuring an intuitive user interface and powerful data handling capabilities.

## Live Version

🔗 **[Use this Viewer now on Vercel](https://opendatasetjson.vercel.app/)**

Don't want to install? Use our live version directly! The application is deployed on Vercel and ready to use in your browser. No installation required - just visit the link above and start analyzing your datasets.

## Example Dataset-JSON files

The example folder under [DataExchange-DatasetJson](https://github.com/cdisc-org/DataExchange-DatasetJson)

## Dataset-JSON

For more information about Dataset-JSON, please refer to the following links:
- [Dataset-JSON](https://www.cdisc.org/standards/data-exchange/dataset-json)
- [Dataset-JSON v1.1 Specification](https://wiki.cdisc.org/display/PUB/Dataset-JSON+1.1+-+Specification)
- [Dataset-JSON v1.1 User's Guide](https://wiki.cdisc.org/display/PUB/Dataset-JSON+v1.1+User%27s+Guide)

## Author

Designer: Yuxin Shen (ys6743@nyu.edu)

Programmer: [@1mgroot](https://github.com/1mgroot)

If you have any questions or suggestions, please contact us at ys6743@nyu.edu. Or add issues on GitHub.

## Screenshots

### Main Interface
![Dataset-JSON Viewer Main Interface](/public/images/image.png)
The main interface showcases the application's clean and intuitive design. It features a sidebar for folder navigation, a tab-based file system, and a powerful data table with sorting, filtering, and column management capabilities.

### Dataset Analysis
![Dataset Frequency Overview](/public/images/image-1.png)
The Dataset Frequency Overview provides detailed insights into your data. It displays unique values for each column, their frequencies, and percentages, helping users quickly understand data distributions and patterns.

## Privacy & Security

🔒 **Client-Side Only Processing**
- All data processing happens in your browser
- No data is ever uploaded to any server
- No user information or files are stored
- Safe for sensitive data analysis

## Features

### File Handling
- 📁 Support for both folder and individual file uploads
- 📄 Handles both JSON and NDJSON (New-line Delimited JSON) formats
- 🔄 Efficient streaming for large files
- 📊 Automatic metadata extraction
- 🗂️ Multi-file support with tab-based navigation
- 💾 Define.xml metadata integration

### Data Visualization & Analysis
- 📊 Interactive data table with:
  - Multi-column sorting
  - Column visibility toggle
  - Drag-and-drop column reordering
  - Smart pagination
  - Responsive layout
- 🏷️ Dynamic column name/label switching
- 📱 Mobile-friendly design
- 📈 Dataset Frequency Overview:
  - Visual representation of unique values
  - Frequency counts for each value
  - Numeric vs text data identification
  - Quick value distribution analysis

### Data Management
- 🔍 Advanced filtering capabilities:
  - Simple text-based filtering
  - Complex filter builder with AND/OR operations
  - Support for multiple operators (=, !=, >, <, >=, <=, contains, in, not in)
  - Filter saving functionality
  - Real-time filter string preview with copy feature
- ⚡ Efficient data loading with progress indicators
- 🔄 Auto-clearing filters when conditions are removed

## Getting Started

### Prerequisites
- Node.js (version 18 or higher)
- npm or yarn
- Modern web browser with JavaScript enabled

### Installation

1. Clone the repository:
```bash
git clone https://github.com/1mgroot/open-dataset-json.git
cd open-dataset-json
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Loading Data
1. **Upload Files/Folders**:
   - Click "Upload Files" to select individual JSON/NDJSON files
   - Click "Upload Folder" to select a folder containing JSON/NDJSON files
   - Or drag and drop files/folders directly onto the interface
   - All processing is done client-side for data privacy

2. **Format Selection**:
   - Choose between JSON or NDJSON format
   - The application will automatically process the files accordingly

### Working with Data
1. **Viewing Data**:
   - Navigate between files using the tab interface
   - Toggle between column names and labels
   - Show/hide columns using the visibility toggle
   - Reorder columns via drag and drop
   - Sort data by clicking column headers (multi-column sort supported)

2. **Analyzing Data**:
   - Use the Dataset Frequency Overview to understand value distributions
   - View frequency counts and percentages for each unique value
   - Identify numeric vs text columns
   - Copy frequency data for further analysis

3. **Filtering Data**:
   - Use the simple filter input for quick searches
   - Use the Filter Builder for complex conditions
   - Combine multiple conditions with AND/OR operators
   - Save frequently used filters
   - Preview and copy generated filter strings
   - Filters auto-clear when all conditions are removed

4. **Performance Features**:
   - Lazy loading for large datasets
   - Progress indicators for long operations
   - Row limit management to prevent browser overload
   - Client-side processing for data privacy

## Technical Stack

### Core Technologies
- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components

### Key Libraries
- [@dnd-kit](https://dndkit.com/) - Drag and drop functionality
- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- [Lucide React](https://lucide.dev/) - Icons
- [stream-json](https://www.npmjs.com/package/stream-json) - JSON streaming

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [shadcn/ui](https://ui.shadcn.com/) components
- Icons by [Lucide](https://lucide.dev/)
- Inspired by the need for efficient dataset viewing tools
