# 🏔️ PeakLog

A production-level training and performance tracking web application for sports teams, originally designed for canoe/kayak groups but generic enough for any endurance sport team (rowing, swimming, running, etc.).

🌐 **Live Demo**: [https://peaklog-a10b4.web.app](https://peaklog-a10b4.web.app)

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite 7
- **UI Framework**: ShadCN UI + TailwindCSS v4
- **Backend**: Firebase (Auth + Firestore + Analytics)
- **Authentication**: Firebase Auth (Email/Password + Passwordless Magic Links)
- **Database**: Cloud Firestore
- **Routing**: React Router DOM v6
- **Form Handling**: React Hook Form
- **Icons**: Lucide React
- **Code Quality**: ESLint + Prettier
- **Deployment**: Firebase Hosting + GitHub Actions CI/CD

## ✨ Features

### 🔐 Authentication & Security
- **🪄 Passwordless Magic Link Login** - Secure, password-free authentication via email links
- **🔑 Traditional Email/Password** - Classic login option available
- **👥 Role-Based Access Control** - Admin and athlete permissions
- **🛡️ Firebase Security Rules** - Server-side data protection
- **🔒 Environment Variable Protection** - Secure API key management

### 📊 Training Management
- **📝 Training Logs** - Comprehensive session logging with type, duration, notes
- **🏆 Personal Records** - Track PRs across different sports and activities
- **📅 Attendance Tracking** - Present/excused/unexcused status management
- **🎯 Goal Setting** - Individual athlete goal creation and tracking
- **📈 Progress Visualization** - Training statistics and progress tracking

### 🎨 User Experience
- **🌟 Modern UI** - Beautiful, responsive design with ShadCN components
- **📱 Mobile-First** - Optimized for all device sizes
- **⚡ Fast Performance** - Vite-powered development and optimized builds
- **🔄 Real-time Updates** - Live data synchronization with Firestore
- **🎭 Professional Design** - Clean, intuitive interface for athletes and coaches

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ (required for Firebase CLI v14+)
- Firebase project with Authentication, Firestore, and Hosting enabled
- Git
- Firebase CLI (`npm install -g firebase-tools`)

### 1. Clone and Install

```bash
git clone https://github.com/alexlibe95/PeakLog.git
cd PeakLog
npm install
```

### 2. Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
2. **Enable Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Email/Password" provider
   - Enable "Email link (passwordless sign-in)" 
   - Add your domain to authorized domains (localhost, your-domain.com)
3. **Create Firestore Database**:
   - Go to Firestore Database → Create database
   - Start in test mode (we'll add security rules later)
4. **Enable Hosting**:
   - Go to Hosting → Get started
5. Copy your Firebase config from Project Settings → General → Your apps

### 3. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 4. Firestore Security Rules

Copy the contents of `firestore.rules` to your Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Training logs - users can CRUD their own, admins can read all
    match /trainingLogs/{logId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5180` to see the app!

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # ShadCN UI components (Button, Input, Card, etc.)
│   ├── features/       # Feature-specific components
│   ├── Navigation.jsx  # Global navigation component
│   ├── PasswordlessLogin.jsx  # Magic link authentication
│   └── ProtectedRoute.jsx     # Route protection wrapper
├── pages/              # Route components
│   ├── Login.jsx       # Login page with dual auth options
│   ├── Register.jsx    # User registration
│   ├── AuthCallback.jsx # Email link verification handler
│   ├── Dashboard.jsx   # Main dashboard
│   └── TrainingLogs.jsx # Training session management
├── context/            # React context providers
│   └── AuthContext.jsx # Authentication state management
├── lib/                # Configuration and utilities
│   └── firebase.js     # Firebase initialization
├── services/           # API and data services
│   └── trainingService.js # Firestore training data operations
└── styles/             # Global styles
    └── index.css       # TailwindCSS + custom styles
```

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server (localhost:5180)
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
npm run type-check   # TypeScript type checking

# Firebase Deployment
firebase deploy      # Deploy to Firebase Hosting
firebase serve       # Test production build locally
firebase login       # Authenticate with Firebase CLI
```

## 🎯 User Roles

### Athlete
- View personal dashboard
- Log training sessions
- Track personal records
- Set and manage goals
- View attendance status

### Admin
- All athlete capabilities
- Manage team members
- View all athlete data
- Create attendance records
- Team analytics and reports

## 🔐 Security

- Role-based access control
- Firestore security rules
- Environment variable protection
- Firebase Authentication

## 🚀 Deployment

This project is configured for **Firebase Hosting** with automatic CI/CD via GitHub Actions.

### Automatic Deployment

- **Production**: Push to `main` branch → Auto-deploy to [https://peaklog-a10b4.web.app](https://peaklog-a10b4.web.app)
- **Preview**: Create pull request → Auto-deploy preview for testing
- **Manual**: Run `firebase deploy` for immediate deployment

### GitHub Actions Setup

The project includes pre-configured workflows:
- `.github/workflows/firebase-hosting-merge.yml` - Production deployments
- `.github/workflows/firebase-hosting-pull-request.yml` - PR previews

### Manual Deployment

```bash
# Build and deploy to Firebase Hosting
npm run build
firebase deploy

# Or deploy with Firebase CLI
firebase login
firebase use peaklog-a10b4
firebase deploy --only hosting
```

### Environment Variables

Set these in your deployment environment:
- All `VITE_FIREBASE_*` variables from your `.env` file
- Firebase automatically handles hosting configuration

## 🎮 Authentication Demo

### Magic Link Login
1. Visit the login page
2. Click "**Sign in with Magic Link**" (recommended)
3. Enter your email address
4. Check your email and click the magic link
5. Automatically signed in - no password required!

### Traditional Login
- Standard email/password authentication also available
- Registration page with sport selection and user details

## 🔧 Development Guidelines

### Code Standards
1. **Code Style**: Follow existing patterns and ESLint/Prettier rules
2. **Components**: Use functional components with hooks
3. **Styling**: Use ShadCN UI components + TailwindCSS classes (no inline styles)
4. **Architecture**: Keep components small, reusable, and well-documented
5. **Security**: Follow Firebase security best practices
6. **Testing**: Test both authentication methods before commits

### Development Workflow
```bash
git checkout -b feature/your-feature
npm run lint:fix && npm run format
git commit -m "feat: your feature description"
git push origin feature/your-feature
# Automatic preview deployment via GitHub Actions
```

## 📋 Roadmap

### 🎯 Core Features (Implemented)
- [x] **Magic Link Authentication** - Passwordless login via email
- [x] **Traditional Authentication** - Email/password backup
- [x] **Role-Based Access** - Admin and athlete permissions
- [x] **Training Logs** - Session logging with types and notes
- [x] **Personal Records** - PR tracking system
- [x] **Modern UI** - ShadCN + TailwindCSS design system
- [x] **Firebase Integration** - Auth, Firestore, Hosting
- [x] **CI/CD Pipeline** - GitHub Actions auto-deployment

### 🚀 Future Enhancements
- [ ] **Advanced Analytics** - Performance trends and insights
- [ ] **Team Management** - Coach dashboard and team overview
- [ ] **Data Export** - CSV/PDF export functionality
- [ ] **Mobile App** - React Native companion app
- [ ] **Training Plans** - Structured workout templates
- [ ] **Performance Charts** - Interactive data visualizations
- [ ] **Team Communication** - In-app messaging and notifications
- [ ] **Offline Support** - PWA capabilities for offline usage

## 🛠️ Technical Highlights

### Modern React Patterns
- **Context API** for global state management
- **Custom Hooks** for reusable logic
- **Component Composition** with ShadCN UI
- **TypeScript-Ready** architecture (JS with type-safe patterns)

### Firebase Integration
- **Firebase v9+ SDK** - Latest modular Firebase implementation
- **Real-time Data** - Live updates with Firestore subscriptions
- **Security Rules** - Server-side data protection
- **Cloud Functions Ready** - Architecture supports serverless functions

### Performance Optimizations
- **Vite Build Tool** - Lightning-fast development and optimized builds
- **Code Splitting** - Automatic chunking for faster loading
- **Tree Shaking** - Minimal bundle size
- **CDN Deployment** - Firebase global CDN hosting

### Developer Experience
- **Hot Module Replacement** - Instant development feedback
- **ESLint + Prettier** - Automated code quality
- **GitHub Actions** - Automated testing and deployment
- **Environment Management** - Secure credential handling

## 📄 License

This is a private portfolio project. All rights reserved.

---

**🏔️ Built with ❤️ for the sports community**

**💡 Showcasing modern web development practices with React, Firebase, and cutting-edge authentication patterns**