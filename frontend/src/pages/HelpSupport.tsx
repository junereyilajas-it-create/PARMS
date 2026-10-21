import { useEffect, useState, type FormEvent } from 'react';
import { 
  Search, 
  Plus, 
  LifeBuoy, 
  FileText, 
  MessageSquare, 
  ShieldAlert, 
  BookOpen, 
  MapPin, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  HelpCircle, 
  Phone, 
  Mail, 
  RotateCcw
} from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import api from '../lib/api';

interface TutorialStep {
  title: string;
  description: string;
  badge?: string;
}

interface HelpItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  roles?: string[];
  steps?: TutorialStep[];
  faqAnswer?: string;
  tips?: string[];
  tags: string[];
}

export function HelpSupport() {
  const { showSuccess, showError } = useModal();
  const [activeMainTab, setActiveMainTab] = useState<'guides' | 'faqs' | 'tickets' | 'manage'>('guides');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  const userRole = (localStorage.getItem('accessor_role') || 'staff').toLowerCase();

  // Categories list
  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'getting-started', label: '1. Getting Started' },
    { id: 'navigation', label: '2. System Navigation' },
    { id: 'auth-accounts', label: '3. Login & Accounts' },
    { id: 'users-roles', label: '4. User & Role Management', adminOnly: true },
    { id: 'properties', label: '5. Property Management' },
    { id: 'lots', label: '6. Lot Management' },
    { id: 'buildings', label: '7. Building Management' },
    { id: 'gis-mapping', label: '8. GIS Mapping & Boundary Drawing' },
    { id: 'gis-requests', label: '9. Mapping Requests & Approval' },
    { id: 'assessments', label: '10. Property Assessment' },
    { id: 'assignments', label: '11. Assessment Assignments' },
    { id: 'certificates', label: '12. Certificate Requests' },
    { id: 'reports', label: '13. Reports & Monthly Reports' },
    { id: 'report-history', label: '14. Report History' },
    { id: 'system-settings', label: '15. System Settings', adminOnly: true },
    { id: 'account-settings', label: '16. Account Settings' },
    { id: 'troubleshooting', label: '17. Troubleshooting' },
    { id: 'contact', label: '18. Technical Support' },
  ];

  // Comprehensive System Tutorials and Guides
  const helpArticles: HelpItem[] = [
    {
      id: 'gs-overview',
      category: 'getting-started',
      title: 'Welcome to PARMS (Property Assessor Records Management System)',
      summary: 'PARMS is the official property assessment and GIS tax mapping system for the Municipality of Lagonglong, Misamis Oriental.',
      roles: ['super_admin', 'admin', 'staff', 'assessor', 'client'],
      steps: [
        { title: 'Log in with your assigned credentials', description: 'Enter your municipal username and secure password on the login screen.' },
        { title: 'Explore your customized dashboard', description: 'Review municipality inventory (Total Properties = 21 Lots + 15 Buildings = 36 total), active assessments, and pending requests.' },
        { title: 'Navigate using the sidebar', description: 'Access permitted modules based on your role (Staff, Assessor, Admin, or Super Admin).' }
      ],
      tips: [
        'Total Properties = Total Lots + Total Buildings at all times in PARMS.',
        'Property records remain strictly localized to the 7 official barangays of Lagonglong, Misamis Oriental.'
      ],
      tags: ['overview', 'intro', 'lagonglong', 'properties', 'start']
    },
    {
      id: 'nav-sidebar',
      category: 'navigation',
      title: 'How to Navigate PARMS and Sidebar Menu',
      summary: 'Learn how to use the collapsible sidebar, filters, pagination, and search tables across modules.',
      roles: ['super_admin', 'admin', 'staff', 'assessor', 'client'],
      steps: [
        { title: 'Sidebar Modules', description: 'Click any module link (Dashboard, Lots, Buildings, GIS Tax Map, Appraisals, Assignments, Certificates, Reports, Settings).' },
        { title: 'Search & Status Filters', description: 'Use search bars to filter by PIN, Lot Number, ARP Number, or Owner name. Use dropdowns to filter by Barangay or Assessment Status.' },
        { title: 'View Details', description: 'Click the Eye icon on any data table row to inspect complete property or assessment records.' },
        { title: 'Secure Logout', description: 'Click the Logout button at the bottom of the sidebar when stepping away from municipal workstations.' }
      ],
      tips: ['Items displayed in the sidebar adapt dynamically to your user role.'],
      tags: ['sidebar', 'navigation', 'menus', 'search', 'filter']
    },
    {
      id: 'prop-add-lot',
      category: 'lots',
      title: 'How to Add and Register a New Lot Parcel',
      summary: 'Step-by-step procedure for authorized Staff and Admins to record a new land parcel in Lagonglong.',
      roles: ['super_admin', 'admin', 'staff'],
      steps: [
        { title: 'Open the Lots module', description: 'Navigate to "Lots" from the sidebar menu to view all registered land parcels.' },
        { title: 'Click "Add Property" or "Register Lot"', description: 'Open the Lot Registration modal.' },
        { title: 'Enter Property Identification', description: 'Provide the unique PIN (Property Identification Number), ARP Number, Survey/Cadastral Lot Number, and Block Number.' },
        { title: 'Select Jurisdiction Barangay', description: 'Select the correct Lagonglong barangay (Dampil, Gaston, Kauswagan, Lumbo, Mabini, Poblacion, Tabok).' },
        { title: 'Specify Lot Dimensions and Area', description: 'Input total land area in square meters (sqm) and classification (e.g. Residential, Agricultural, Commercial).' },
        { title: 'Enter Owner Information', description: 'Provide the registered owner full name, contact number, and postal address.' },
        { title: 'Save and Verify Record', description: 'Submit the form. The newly recorded lot immediately reflects in total inventory (Total Properties = Total Lots + Total Buildings).' }
      ],
      tips: [
        'Cadastral lot numbers must be valid and accurately documented on municipal land tax records.',
        'Newly recorded lots start as "Unmapped" until mapped in the GIS Tax Mapping module.'
      ],
      tags: ['add lot', 'new property', 'cadastral', 'land', 'registration']
    },
    {
      id: 'prop-add-building',
      category: 'buildings',
      title: 'How to Add and Register a Building Structure',
      summary: 'Procedure to register residential, commercial, or institutional buildings attached to a parcel lot.',
      roles: ['super_admin', 'admin', 'staff'],
      steps: [
        { title: 'Open the Buildings module', description: 'Click "Buildings" in the sidebar to review the structural property inventory.' },
        { title: 'Click "Add Property"', description: 'Launch the building registration workflow.' },
        { title: 'Select the Host Lot Parcel', description: 'Link the building to its host cadastral lot parcel in Lagonglong.' },
        { title: 'Enter Structural Details', description: 'Specify building type, number of storeys, total floor area in sqm, roof/wall construction materials, and year completed.' },
        { title: 'Assign Owner & Assessment Info', description: 'Confirm building owner details and initial declared market value.' },
        { title: 'Save Record', description: 'Submit the registration. Both lot parcels and building records are counted under Total Properties.' }
      ],
      tips: ['A single lot parcel can host multiple building structures.'],
      tags: ['building', 'structure', 'add building', 'property']
    },
    {
      id: 'gis-boundary-drawing',
      category: 'gis-mapping',
      title: 'How to Draw Lot Boundaries with Numbered Corner Points in GIS',
      summary: 'Use the interactive Leaflet GIS Boundary Drawing tool to input numbered corner points (1–2, 2–3, etc.), lengths in meters, area calculations, and vertex adjustments.',
      roles: ['super_admin', 'admin', 'staff', 'assessor'],
      steps: [
        { title: 'Open GIS Mapping Module', description: 'Select "GIS Tax Map" from the sidebar navigation.' },
        { title: 'Select Property to Map', description: 'Search for the property by PIN or Owner. Click "Map Property" or "Edit Boundary".' },
        { title: 'Enter Number of Sides', description: 'In the boundary tool, choose the number of property sides (e.g., 4 sides for a quadrilateral lot).' },
        { title: 'Input Distances by Consecutive Numbered Points', description: 'Enter the exact measured boundary lengths between consecutive corners (e.g. Point 1–2 = 14.48 m, Point 2–3 = 8.60 m, Point 3–4 = 14.35 m, Point 4–1 = 6.60 m).' },
        { title: 'Inspect High-Contrast Boundary Lines', description: 'Notice the distinct dual-layer stroke (outer dark halo + inner vibrant line) visible over both street and satellite imagery.' },
        { title: 'Verify Side-Length Badges', description: 'Numbered point labels (e.g. 1–2: 14.48 m) are automatically offset beside the segment and never obscure or cover the boundary line.' },
        { title: 'Adjust Vertices if Necessary', description: 'Drag numbered corner pins (1, 2, 3, 4) to match actual cadastral corners. Connected boundary lines stay attached to their endpoints.' },
        { title: 'Save GIS Location', description: 'Click "Save Boundary & Coordinates". The property status transitions from Unmapped to Mapped.' }
      ],
      tips: [
        'Active sides highlight in vibrant amber when focused or hovered in the input table.',
        'Entering side lengths provides geometric guidance; field verification by an authorized surveyor is recommended for official land titling.'
      ],
      tags: ['gis', 'boundary', 'drawing', 'point pairs', '1-2', 'corner points', 'vertex', 'leaflet']
    },
    {
      id: 'gis-staff-approval',
      category: 'gis-requests',
      title: 'Staff Workflow: Requesting Mapping Approval',
      summary: 'Staff members must request approval before mapping unmapped properties or modifying existing parcel coordinates.',
      roles: ['staff', 'admin', 'super_admin'],
      steps: [
        { title: 'Search Unmapped Property', description: 'Locate the property in the GIS map sidebar with status "Unmapped".' },
        { title: 'Click "Request to Map"', description: 'Staff accounts will see the request action instead of direct editing permissions.' },
        { title: 'Submit Justification and Notes', description: 'Provide the mapping reason (e.g., "Cadastral field survey complete; ready to plot parcel coordinates").' },
        { title: 'Track Request Status', description: 'Review status under "Mapping Requests" (Pending, Approved, Rejected, Completed).' },
        { title: 'Proceed Once Approved', description: 'When Admin or Super Admin approves the request, Staff can launch the boundary editor to plot and save coordinates.' }
      ],
      tips: ['Admins and Super Admins can map or edit properties directly without creating a request.'],
      tags: ['request to map', 'approval', 'staff workflow', 'permissions']
    },
    {
      id: 'assessments-workflow',
      category: 'assessments',
      title: 'How Field Assessments and Appraisals Are Conducted',
      summary: 'Complete workflow for field appraisals, market value calculations, and Admin review/approval.',
      roles: ['super_admin', 'admin', 'assessor'],
      steps: [
        { title: 'Admin Assigns Assessment', description: 'Admin navigates to "Assignments" and assigns a property to a licensed field Assessor.' },
        { title: 'Assessor Reviews Assigned Properties', description: 'Assessor logs into PARMS and views their assigned queue in the Appraisals module.' },
        { title: 'Submit Field Appraisal', description: 'Assessor enters the property inspection data: land/building market value, assessment level percentage, and computed assessed value.' },
        { title: 'Submission Awaiting Review', description: 'The assessment status becomes "submitted".' },
        { title: 'Admin Review and Approval', description: 'Admin or Head Assessor reviews the valuation and clicks "Approve". Once approved, the assessment value enters official municipal tax records.' }
      ],
      tips: [
        'Total Assessed Value (PHP) = Market Value × Assessment Level (%).',
        'Approved assessments are immediately included in the monthly and semi-annual revenue reports.'
      ],
      tags: ['assessment', 'appraisal', 'assessor', 'market value', 'assessed value', 'approval']
    },
    {
      id: 'cert-requests',
      category: 'certificates',
      title: 'How to Request and Issue Official Tax Declarations & Certificates',
      summary: 'Guide for property owners requesting certificates and Staff processing official assessor documents.',
      roles: ['client', 'staff', 'admin', 'super_admin'],
      steps: [
        { title: 'Submit Certificate Request', description: 'Go to "Certificates" > "Request Certificate". Select property and certificate type (e.g., Certificate of No Improvement, Certified Tax Declaration copy).' },
        { title: 'Staff Review & Verification', description: 'Authorized municipal staff inspect the property status and verify that real property taxes are current.' },
        { title: 'Generate Official Document', description: 'Staff generate the official certificate featuring the municipal seal, date, and prepared signature.' },
        { title: 'Release Certificate to Client', description: 'Mark request as Approved and print or download the official certificate for the property owner.' }
      ],
      tips: ['Clients can track the progress of their submitted certificate requests in real time.'],
      tags: ['certificate', 'tax declaration', 'request', 'issuance']
    },
    {
      id: 'reports-monthly',
      category: 'reports',
      title: 'How to Generate and Export Monthly Reports',
      summary: 'Generate monthly cadastral and assessment reports based on real database records for any selected month and year.',
      roles: ['super_admin', 'admin'],
      steps: [
        { title: 'Open Reports Module', description: 'Navigate to "Reports" in the sidebar.' },
        { title: 'Select "Monthly Cadastral & Assessment Report"', description: 'Choose Monthly Report from the Report Type selector.' },
        { title: 'Select Month, Year, and Focus Category', description: 'Pick the target calendar month (e.g. October), Year (e.g. 2026), and category (Comprehensive, Properties, Assessments, or Certificates).' },
        { title: 'Click "Generate Report"', description: 'PARMS executes backend queries against real database records and renders the official municipal report.' },
        { title: 'Inspect Real Inventory vs Monthly Activity', description: 'Review Cumulative Real Property Inventory (Total Properties = 36) alongside activity conducted specifically during that month.' },
        { title: 'Print or Export as CSV', description: 'Click "Print Document" for official hardcopy format or "Export as CSV" for spreadsheet audits.' },
        { title: 'Save to Official History', description: 'Click "Save to Official History" to store a persistent JSON snapshot in the database audit log.' }
      ],
      tips: [
        'Cumulative inventory totals (36 properties) are clearly distinguished from newly added items during the selected period.',
        'Month boundaries are calculated precisely on the backend.'
      ],
      tags: ['monthly reports', 'reports', 'generate', 'csv', 'print', 'inventory']
    },
    {
      id: 'reports-history-click',
      category: 'report-history',
      title: 'How to Open Historical Reports from Report History',
      summary: 'Every row in Report History is clickable and opens the exact saved snapshot without recalculating or altering historical figures.',
      roles: ['super_admin', 'admin'],
      steps: [
        { title: 'Go to Reports > Report History', description: 'Click the "Report History" tab at the top right of the Reports page.' },
        { title: 'Click Any History Row', description: 'Hover over any row (pointer cursor and highlight appear) and click to view.' },
        { title: 'Review Historical Report Snapshot', description: 'The system loads the archived report snapshot including reporting period, generation date, author, and detailed metrics.' },
        { title: 'Print or Audit Saved Copy', description: 'Print the archived report directly from the detail view.' },
        { title: 'Return to History List', description: 'Click "Back to Report History" to return to the full table of historical reports.' }
      ],
      tips: ['Historical reports preserve their original figures even when new properties or assessments are added later.'],
      tags: ['report history', 'clickable row', 'audit', 'snapshot', 'archive']
    },
    {
      id: 'settings-system-admin',
      category: 'system-settings',
      title: 'How to Manage System Settings and Download Database Backups',
      summary: 'Configure municipal office details, display preferences, security policies, and download complete database archives.',
      roles: ['super_admin', 'admin'],
      steps: [
        { title: 'Open System Settings', description: 'Navigate to "System Settings" from the sidebar.' },
        { title: 'Office & Jurisdiction', description: 'Review and update office contact numbers, email, and municipal jurisdiction for Lagonglong, Misamis Oriental.' },
        { title: 'Preferences & Appearance', description: 'Configure default date formats, time display (12h/24h), reporting periods, and page sizes.' },
        { title: 'Security & Access Policy', description: 'Adjust session timeout minutes, max failed login attempts, lockout duration, and password length policy.' },
        { title: 'Download Database JSON Backup', description: 'In the Maintenance & Backup tab, Super Admins can click "Download Database JSON" to export a complete offline database archive.' },
        { title: 'Review System Audit Logs', description: 'Inspect the live audit log table displaying recent administrative actions with timestamps and users.' }
      ],
      tips: ['Sensitive maintenance operations and full database backups are restricted to Super Admin role.'],
      tags: ['system settings', 'backup', 'audit log', 'security', 'maintenance']
    },
    {
      id: 'settings-account-user',
      category: 'account-settings',
      title: 'How to Manage Your Personal Account & Change Password',
      summary: 'Update your first name, middle name, last name, email, contact number, personal theme, and change password securely.',
      roles: ['super_admin', 'admin', 'staff', 'assessor', 'client'],
      steps: [
        { title: 'Open Account Settings', description: 'Click "Account Settings" at the bottom of the sidebar or from your profile menu.' },
        { title: 'Update Profile Information', description: 'Edit permitted fields including First Name, Middle Name, Last Name, Email, and Contact Number.' },
        { title: 'Configure Personal Theme', description: 'Choose your preferred appearance (Light Mode, Dark Mode, or System Default) without affecting other users.' },
        { title: 'Set Notification Preferences', description: 'Toggle notifications for assessment updates and GIS mapping alerts.' },
        { title: 'Change Account Password', description: 'Under Change Password, enter your current password, then input a new password of at least 8 characters and confirm it.' },
        { title: 'Use Show/Hide Password Toggle', description: 'Click the eye icon to verify typed passwords before submitting.' },
        { title: 'Save and Confirm', description: 'Click Save. New credentials take effect immediately.' }
      ],
      tips: [
        'User roles cannot be modified through Account Settings.',
        'Passwords must be at least 8 characters long for security compliance.'
      ],
      tags: ['profile', 'account settings', 'password', 'theme', 'notifications']
    }
  ];

  // 23 Practical Frequently Asked Questions
  const faqs = [
    {
      q: 'Why can\'t I log in to my account?',
      a: 'Verify your username and password. Usernames are case-sensitive. If you attempted multiple failed logins, your account may be temporarily locked according to the security policy. Contact your Super Admin to verify account activation.',
      cat: 'auth-accounts'
    },
    {
      q: 'What should I do if I forget my password?',
      a: 'Reach out to your Municipal System Administrator (Super Admin) who can securely reset your credentials from the User Management console.',
      cat: 'auth-accounts'
    },
    {
      q: 'Why is my account not allowed to open a page?',
      a: 'PARMS uses strict role-based access control. Staff, Assessors, Admins, and Super Admins each have distinct permissions. If you require access to a module (such as Reports or User Management), ask an Administrator to review your role assignment.',
      cat: 'auth-accounts'
    },
    {
      q: 'Why can I see a property but cannot edit it?',
      a: 'Staff accounts can view property records but may require administrative authorization or submit a request to modify mapped GIS coordinates or approved assessments.',
      cat: 'properties'
    },
    {
      q: 'Why is a property marked "Unmapped"?',
      a: 'A property is marked "Unmapped" when it has been registered in the database (with lot/building details and PIN) but has not yet had its spatial GIS parcel coordinates plotted and saved on the map.',
      cat: 'gis-mapping'
    },
    {
      q: 'How do I request permission to map a property?',
      a: 'If you are logged in as Staff, navigate to GIS Tax Map, select the unmapped property, and click "Request to Map". Enter a brief note describing the cadastral survey status and submit the request for Admin approval.',
      cat: 'gis-requests'
    },
    {
      q: 'Why can\'t Staff map a property immediately?',
      a: 'To maintain cadastral integrity and prevent accidental parcel boundary collisions in Lagonglong, Staff mapping actions require verification and approval from the Municipal Assessor or Admin before coordinates are permanently plotted.',
      cat: 'gis-requests'
    },
    {
      q: 'How can I tell whether my mapping request was approved?',
      a: 'Open the GIS Tax Map or check your notifications. Approved mapping requests display an "Approved" badge, enabling the "Plot Boundary" button on the property.',
      cat: 'gis-requests'
    },
    {
      q: 'Why were side-length labels hard to read and how was it fixed?',
      a: 'Previously, text labels were rendered directly on top of the boundary line segments. In this update, all boundary labels (e.g. 1–2: 14.48 m) are calculated with outward perpendicular normal offsets so they sit beside the line with clear point pair notation, never obstructing or breaking the boundary stroke.',
      cat: 'gis-mapping'
    },
    {
      q: 'Why did my GIS boundary mapping fail to save?',
      a: 'Ensure all required polygon vertices are closed (minimum 3 coordinates for a polygon) and that you have an active network session. If you are Staff, verify that your mapping request was approved by Admin.',
      cat: 'gis-mapping'
    },
    {
      q: 'Why is the property count 36 instead of only lots?',
      a: 'PARMS follows the official property-counting rule: Total Properties = Total Lots (21) + Total Buildings (15) = 36 Total Properties. Both land parcels and structural improvements are classified as real property records.',
      cat: 'properties'
    },
    {
      q: 'Why are lots and buildings included in Total Properties?',
      a: 'Under Philippine Real Property Tax administration, both land (lots) and improvements (buildings/machinery) have independent Tax Declarations and market values, contributing together to total real property inventory.',
      cat: 'properties'
    },
    {
      q: 'How do I add a lot parcel?',
      a: 'Navigate to "Lots" in the sidebar, click "Add Property", enter the PIN, ARP, Cadastral Lot Number, Barangay in Lagonglong, Area in sqm, and Owner details, then click Save.',
      cat: 'lots'
    },
    {
      q: 'How do I add a building property?',
      a: 'Navigate to "Buildings" in the sidebar, click "Add Property", select the host lot parcel, enter building type, floor area, materials, owner information, and save the record.',
      cat: 'buildings'
    },
    {
      q: 'How do I search for a property in PARMS?',
      a: 'Use the global search bar on the Lots, Buildings, or GIS Map pages. You can search by Property Identification Number (PIN), Survey Lot Number, ARP Number, or registered Owner Name.',
      cat: 'properties'
    },
    {
      q: 'How do I request an official certificate?',
      a: 'Navigate to "Certificates" in the sidebar, click "Request Certificate", select the target property, provide request details, and submit for municipal processing.',
      cat: 'certificates'
    },
    {
      q: 'How do I generate a monthly report?',
      a: 'Go to Reports > Generate Report, select "Monthly Cadastral & Assessment Report", pick your desired Month and Year, and click "Generate Report".',
      cat: 'reports'
    },
    {
      q: 'How do I open a previously generated report?',
      a: 'Go to Reports > Report History. Simply click any row in the table to open its full saved snapshot, view summary metrics, and print or export it.',
      cat: 'report-history'
    },
    {
      q: 'Why is a generated report empty?',
      a: 'If a newly selected reporting month has no new property registrations or appraisals created during those exact calendar dates, the monthly activity section will be zero. However, cumulative municipal inventory (36 properties) will still reflect accurate totals as of that date.',
      cat: 'reports'
    },
    {
      q: 'Why can\'t I change a system setting?',
      a: 'System-wide settings (jurisdiction, database backups, security policies) require Administrator or Super Administrator role permissions. Regular staff and assessors can customize their own Account Settings.',
      cat: 'system-settings'
    },
    {
      q: 'How do I update my profile details?',
      a: 'Go to Account Settings, update your first name, middle name, last name, email address, or contact number, and click "Save Profile Changes".',
      cat: 'account-settings'
    },
    {
      q: 'How do I change my password securely?',
      a: 'Go to Account Settings > Change Password. Enter your current password, type your new password (at least 8 characters), confirm it, and click "Update Password".',
      cat: 'account-settings'
    },
    {
      q: 'What should I do if the system displays a network or server error?',
      a: 'Ensure you have an active network connection and valid session token. If the backend is undergoing maintenance, wait a moment and refresh the page. If the issue persists, submit a support ticket in the Support tab.',
      cat: 'troubleshooting'
    }
  ];

  // Tickets state
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', category: 'General Inquiry', priority: 'Medium', description: '' });
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const { data } = await api.get('/support-tickets');
      setTickets(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'tickets' || activeMainTab === 'manage') {
      loadTickets();
    }
  }, [activeMainTab]);

  const submitTicket = async (e: FormEvent) => {
    e.preventDefault();
    setSubmittingTicket(true);
    try {
      await api.post('/support-tickets', ticketForm);
      showSuccess('Support request submitted to Municipal IT Administrator.');
      setTicketForm({ subject: '', category: 'General Inquiry', priority: 'Medium', description: '' });
      loadTickets();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const { data } = await api.get(`/support-tickets/${ticketId}/messages`);
      setMessages(data);
    } catch (e) {
      console.error(e);
    }
  };

  const openTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    loadMessages(ticket.ticket_id);
  };

  const submitMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;
    setMessageBusy(true);
    try {
      await api.post(`/support-tickets/${selectedTicket.ticket_id}/messages`, { message: newMessage });
      setNewMessage('');
      loadMessages(selectedTicket.ticket_id);
    } catch (e) {
      showError('Failed to send message.');
    } finally {
      setMessageBusy(false);
    }
  };

  const updateTicketStatus = async (status: string) => {
    if (!selectedTicket) return;
    try {
      await api.put(`/support-tickets/${selectedTicket.ticket_id}`, { status });
      setSelectedTicket({ ...selectedTicket, status });
      loadTickets();
      showSuccess(`Ticket marked as ${status}`);
    } catch (e) {
      showError('Failed to update ticket status.');
    }
  };

  // Filtered Articles based on search & category & role
  const filteredArticles = helpArticles.filter(art => {
    const matchesCategory = selectedCategory === 'all' || art.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = query === '' ||
      art.title.toLowerCase().includes(query) ||
      art.summary.toLowerCase().includes(query) ||
      art.tags.some(t => t.toLowerCase().includes(query)) ||
      (art.steps && art.steps.some(s => s.title.toLowerCase().includes(query) || s.description.toLowerCase().includes(query)));
    
    // Role filter
    const matchesRole = !art.roles || art.roles.includes(userRole);
    return matchesCategory && matchesQuery && matchesRole;
  });

  // Filtered FAQs based on query & category
  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.cat === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = query === '' ||
      faq.q.toLowerCase().includes(query) ||
      faq.a.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-green-800 to-emerald-700 dark:from-green-950 dark:to-emerald-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-xs mb-3">
            <LifeBuoy size={14} /> Official PARMS Knowledge & Support Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">How can we assist you today?</h1>
          <p className="text-green-100 text-sm mt-1.5">
            Complete step-by-step documentation, GIS boundary plotting tutorials, FAQ solutions, and municipal technical support.
          </p>

          <div className="mt-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search tutorials, FAQs, e.g. 'How do I add a lot?', 'GIS boundary', 'side lengths'..."
              className="w-full pl-10 pr-4 py-3 bg-white text-gray-900 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-2">
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 ${
              activeMainTab === 'guides' 
                ? 'bg-green-600 text-white shadow-xs' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            onClick={() => setActiveMainTab('guides')}
          >
            <BookOpen size={16} /> System Guides & Tutorials ({filteredArticles.length})
          </button>
          <button
            className={`px-4 py-2 font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 ${
              activeMainTab === 'faqs' 
                ? 'bg-green-600 text-white shadow-xs' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            onClick={() => setActiveMainTab('faqs')}
          >
            <HelpCircle size={16} /> FAQs ({filteredFaqs.length})
          </button>
          <button
            className={`px-4 py-2 font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 ${
              activeMainTab === 'tickets' 
                ? 'bg-green-600 text-white shadow-xs' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            onClick={() => setActiveMainTab('tickets')}
          >
            <FileText size={16} /> My Support Requests
          </button>
          {(userRole === 'admin' || userRole === 'super_admin') && (
            <button
              className={`px-4 py-2 font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 ${
                activeMainTab === 'manage' 
                  ? 'bg-green-600 text-white shadow-xs' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              onClick={() => setActiveMainTab('manage')}
            >
              <ShieldAlert size={16} /> Manage All Tickets
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <span>Active Role:</span>
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 font-bold uppercase text-[10px]">
            {userRole}
          </span>
        </div>
      </div>

      {/* Main Content Areas */}
      {(activeMainTab === 'guides' || activeMainTab === 'faqs') && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Category Filter Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-2">
                Help Categories
              </h3>
              <div className="space-y-0.5">
                {categories
                  .filter(c => !c.adminOnly || (userRole === 'admin' || userRole === 'super_admin'))
                  .map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                        selectedCategory === cat.id
                          ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 font-bold'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                      }`}
                    >
                      <span className="truncate">{cat.label}</span>
                      {selectedCategory === cat.id && <ChevronRight size={14} className="text-green-600 shrink-0" />}
                    </button>
                  ))}
              </div>
            </div>

            {/* Quick Municipal Support Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 text-xs space-y-2.5">
              <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <MapPin size={15} className="text-green-600" /> Municipal Office
              </h4>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Office of the Municipal Assessor<br />
                Municipal Hall, Poblacion<br />
                Lagonglong, Misamis Oriental
              </p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1 text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-gray-400" /> assessor.lagonglong@gmail.com
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-gray-400" /> (088) 123-4567 / 0917-000-0000
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Guides or FAQs */}
          <div className="lg:col-span-3 space-y-6">
            {activeMainTab === 'guides' && (
              <div className="space-y-6">
                {filteredArticles.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 text-center text-gray-500">
                    <BookOpen size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="font-semibold">No tutorial articles found matching "{searchQuery}".</p>
                    <p className="text-xs mt-1 text-gray-400">Try searching for keywords like 'lot', 'building', 'gis', or 'report'.</p>
                  </div>
                ) : (
                  filteredArticles.map(art => (
                    <div 
                      key={art.id} 
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                    >
                      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/50 px-2 py-0.5 rounded-full mr-2">
                            {art.category.replace(/-/g, ' ')}
                          </span>
                          <h3 className="font-bold text-base text-gray-900 dark:text-white inline">
                            {art.title}
                          </h3>
                        </div>
                      </div>

                      <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {art.summary}
                        </p>

                        {art.steps && (
                          <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                              Step-by-Step Instructions:
                            </h4>
                            <div className="space-y-2.5">
                              {art.steps.map((st, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-sm">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-bold text-xs shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <strong className="text-gray-900 dark:text-white block font-semibold">{st.title}</strong>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">{st.description}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {art.tips && (
                          <div className="p-3 bg-green-50/80 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800/50 space-y-1 text-xs text-green-900 dark:text-green-300">
                            {art.tips.map((tip, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                                <span>{tip}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeMainTab === 'faqs' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Frequently Asked Questions ({filteredFaqs.length})
                  </h3>
                  <span className="text-xs text-gray-500">Click question to expand answer</span>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {filteredFaqs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">No matching questions found for "{searchQuery}".</div>
                  ) : (
                    filteredFaqs.map((faq, i) => {
                      const isExpanded = expandedFaqId === `faq-${i}`;
                      return (
                        <div key={i} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <button
                            onClick={() => setExpandedFaqId(isExpanded ? null : `faq-${i}`)}
                            className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 font-semibold text-sm text-gray-900 dark:text-white focus:outline-none"
                          >
                            <span className="flex items-center gap-2">
                              <HelpCircle size={16} className="text-green-600 shrink-0" />
                              {faq.q}
                            </span>
                            <ChevronDown 
                              size={16} 
                              className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                            />
                          </button>
                          {isExpanded && (
                            <div className="px-6 pb-4 pt-1 text-xs text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-50 dark:border-gray-800/60 bg-gray-50/30 dark:bg-gray-900/20">
                              {faq.a}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tickets Tab (Connected to real database `/api/support-tickets`) */}
      {activeMainTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Submit a Support Request</h3>
              <form onSubmit={submitTicket} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select 
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                    value={ticketForm.category} 
                    onChange={e => setTicketForm({ ...ticketForm, category: e.target.value })}
                  >
                    <option>General Inquiry</option>
                    <option>GIS Mapping Assistance</option>
                    <option>Property Assessment Issue</option>
                    <option>Report Generation Bug</option>
                    <option>Account Assistance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select 
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                    value={ticketForm.priority} 
                    onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                  <input 
                    type="text" 
                    placeholder="Brief description of the problem"
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                    value={ticketForm.subject} 
                    onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })} 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">Detailed Description</label>
                  <textarea 
                    rows={4} 
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white resize-none" 
                    value={ticketForm.description} 
                    onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} 
                    required 
                    placeholder="Please explain what happened, steps to reproduce, and any error message displayed..." 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={submittingTicket} 
                  className="w-full flex justify-center items-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-70"
                >
                  <Plus size={16} /> {submittingTicket ? 'Submitting Request...' : 'Submit Support Request'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">My Support Tickets</h3>
                <button 
                  onClick={loadTickets} 
                  className="text-xs font-semibold text-green-600 flex items-center gap-1 hover:text-green-700"
                >
                  <RotateCcw size={12} /> Refresh
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingTickets ? (
                  <div className="p-8 text-center text-sm text-gray-500">Loading tickets...</div>
                ) : tickets.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {tickets.map(ticket => (
                      <div 
                        key={ticket.ticket_id} 
                        className="p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors" 
                        onClick={() => openTicket(ticket)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 mr-2">#{ticket.ticket_id}</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{ticket.subject}</span>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase
                            ${ticket.status === 'Open' ? 'bg-amber-100 text-amber-800' :
                              ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {ticket.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>Category: {ticket.category}</span>
                          <span>Priority: <strong className={ticket.priority === 'Critical' ? 'text-red-500' : ticket.priority === 'High' ? 'text-amber-500' : ''}>{ticket.priority}</strong></span>
                          <span>Submitted: {new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-gray-500">You haven't submitted any support requests yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Manage Tickets Tab */}
      {activeMainTab === 'manage' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white">All Municipal Support Tickets</h3>
            <span className="text-xs text-gray-500">{tickets.length} total tickets</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-gray-500">
                  <th className="px-4 py-3 font-semibold uppercase">ID</th>
                  <th className="px-4 py-3 font-semibold uppercase">Submitted By</th>
                  <th className="px-4 py-3 font-semibold uppercase">Subject</th>
                  <th className="px-4 py-3 font-semibold uppercase">Category</th>
                  <th className="px-4 py-3 font-semibold uppercase">Priority</th>
                  <th className="px-4 py-3 font-semibold uppercase">Status</th>
                  <th className="px-4 py-3 font-semibold uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {tickets.map(ticket => (
                  <tr key={ticket.ticket_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => openTicket(ticket)}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">#{ticket.ticket_id}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{ticket.first_name} {ticket.last_name}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{ticket.subject}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{ticket.category}</td>
                    <td className={`px-4 py-3 font-medium text-xs ${ticket.priority === 'Critical' ? 'text-red-600' : ticket.priority === 'High' ? 'text-amber-600' : 'text-gray-500'}`}>{ticket.priority}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase
                        ${ticket.status === 'Open' ? 'bg-amber-100 text-amber-800' :
                          ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                            ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(ticket.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tickets.length === 0 && <div className="p-8 text-center text-sm text-gray-500">No tickets found.</div>}
          </div>
        </div>
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs" onClick={(e) => e.target === e.currentTarget && setSelectedTicket(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  #{selectedTicket.ticket_id} - {selectedTicket.subject}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase
                    ${selectedTicket.status === 'Open' ? 'bg-amber-100 text-amber-800' :
                      selectedTicket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        selectedTicket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {selectedTicket.status}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Category: {selectedTicket.category} • Priority: {selectedTicket.priority}</p>
              </div>
              <div className="flex gap-2">
                {(userRole === 'admin' || userRole === 'super_admin') && selectedTicket.status !== 'Closed' && (
                  <button onClick={() => updateTicketStatus('Closed')} className="px-3 py-1.5 text-xs font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg">Close Ticket</button>
                )}
                <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold">&times;</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-950 custom-scrollbar">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-xs">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-sm dark:text-white">{selectedTicket.first_name || 'You'} {selectedTicket.last_name || ''}</span>
                  <span className="text-xs text-gray-400">{new Date(selectedTicket.created_at).toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {messages.map(msg => (
                <div key={msg.message_id} className={`flex flex-col ${msg.role === 'admin' || msg.role === 'super_admin' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-xl p-3 text-xs shadow-xs ${msg.role === 'admin' || msg.role === 'super_admin'
                      ? 'bg-green-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                    <div className="flex justify-between items-center gap-4 mb-1">
                      <span className={`font-semibold text-[10px] uppercase ${msg.role === 'admin' || msg.role === 'super_admin' ? 'text-green-100' : 'text-gray-500'}`}>{msg.first_name} ({msg.role})</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 mx-1">{new Date(msg.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {selectedTicket.status !== 'Closed' && (
              <form onSubmit={submitMessage} className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex gap-3 items-end">
                <div className="flex-1">
                  <textarea
                    rows={2}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white resize-none"
                    placeholder="Type an update or reply..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={messageBusy} 
                  className="h-[42px] px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-70 flex items-center justify-center gap-1.5"
                >
                  <MessageSquare size={14} /> Send
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

