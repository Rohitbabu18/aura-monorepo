# Medical Registration Form - Multi-Step

Complete medical registration portal with multi-step forms for hospitals, clinics, doctors, nurses, and staff.

## 🎯 Features

### ✅ Multi-Step Registration
- **Step 1**: Basic Information (User Type, Name, Contact, Email)
- **Step 2**: Address & Registration Details (Location, Professional info)
- **Step 3**: Additional Information (Services, Facilities - Hospital/Clinic only)

### 🏥 User Types Supported

1. **Hospital** - 3 Steps
   - Basic Info → Address & Registration → Facilities & Services
   
2. **Clinic** - 3 Steps
   - Basic Info → Address & Registration → Services & Details
   
3. **Doctor** - 2 Steps
   - Basic Info → Professional Details
   
4. **Nurse** - 2 Steps
   - Basic Info → Address Details
   
5. **Other Staff** - 2 Steps
   - Basic Info → Address Details

### 📋 Fields Included

#### Common Fields (All Users):
- User Type Selection
- Full Name / Facility Name
- Contact Number (Primary)
- Email Address
- Alternate Contact
- Complete Address
- City, State, PIN Code

#### Hospital/Clinic Specific:
- Facility Type
- Ownership Type
- Registration Number
- License Number
- Established Year
- Total Beds
- Total Staff
- Operating Hours
- Services Offered (Multiple Selection)
- Emergency Services Available
- Ambulance Service Available
- Website URL

#### Doctor Specific:
- Specialization
- Years of Experience
- Medical Registration Number
- Registration Authority

### 🔄 API Integration

Each step automatically saves data via API:
- **POST**: Creates new registration (Step 1)
- **PUT**: Updates existing registration (Step 2, 3)
- Registration ID is stored and used for updates

API Endpoints:
```javascript
POST   /api/register      // Step 1 - Create
PUT    /api/register/:id  // Step 2, 3 - Update
```

### 🎨 UI Features
- Dark/Light theme toggle
- Step indicator with progress
- Form validation at each step
- Smooth animations
- Mobile responsive
- Error handling

## 📁 Project Structure

```
medical-web/
├── public/
│   └── index.html
├── src/
│   ├── constants/
│   │   └── appConstants.js    # All data, colors, fonts
│   ├── context/
│   │   └── ThemeContext.js    # Theme management
│   ├── App.js                 # Main component with all logic
│   ├── App.css                # All styles
│   └── index.js
├── package.json
└── README.md
```

## 🚀 Installation

```bash
# Extract ZIP
cd medical-web

# Install dependencies
npm install

# Start development server
npm start
```

App opens at `http://localhost:3000`

## 🔧 Configuration

### Change API Endpoint
Edit `src/constants/appConstants.js`:
```javascript
export const API_ENDPOINT = 'https://your-api.com/register';
```

### Add/Remove Services
Edit arrays in `src/constants/appConstants.js`:
```javascript
export const HOSPITAL_SERVICES = [
  'Emergency Services',
  'ICU/CCU',
  // Add more...
];
```

### Customize Colors
Edit in `src/constants/appConstants.js`:
```javascript
export const colors = {
  light: {
    primary: '#059669',
    // Change colors...
  }
}
```

## 📝 Form Validation

### Step 1 (Mandatory):
- User Type
- Name (min 3 characters)
- Contact Number (10 digits, starts with 6-9)
- Email (valid format)

### Step 2 (Mandatory):
- Complete Address
- City
- State
- PIN Code (6 digits)
- Facility Type (Hospital/Clinic)
- Registration Number (Hospital/Clinic)
- Ownership Type (Hospital/Clinic)
- Specialization (Doctor)
- Experience (Doctor)
- Medical Registration Number (Doctor)

### Step 3 (Optional):
- All fields optional
- Basic validation for number fields

## 🔄 How Multi-Step Works

1. **User selects type** → System determines number of steps
2. **Fill Step 1** → Click "Save & Continue" → API POST request
3. **Fill Step 2** → Click "Save & Continue" → API PUT request
4. **Fill Step 3** (if applicable) → Click "Complete Registration" → Final API PUT
5. **Success Modal** → Shows registration ID → Auto-reset after 3 seconds

## 📊 Step Navigation

- **Next**: Validates current step → Saves to API → Moves forward
- **Back**: Allows editing previous steps (no API call)
- **Progress Indicator**: Shows current step and completed steps

## 🎯 API Data Structure

```json
{
  "userType": "hospital",
  "name": "City Hospital",
  "contactNumber": "9876543210",
  "email": "contact@cityhospital.com",
  "address": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pinCode": "400001",
  "facilityType": "Multispecialty Hospital",
  "ownershipType": "Private",
  "registrationNo": "MH/HOS/2024/001",
  "totalBeds": "100",
  "services": ["Emergency Services", "ICU/CCU", "Surgery"],
  "emergencyAvailable": true,
  "step": 3,
  "lastUpdated": "2024-12-24T10:30:00.000Z"
}
```

## 🛠️ Technologies

- React 18.3.1
- Framer Motion 11.0.0
- Context API (Theme)
- System Fonts
- CSS Variables

## 📱 Mobile Responsive

- Adaptive layout for all screen sizes
- Touch-optimized controls
- Mobile-friendly step indicator
- Stacked form rows on mobile

## 🔐 Security Notes

- All mandatory fields validated
- Phone number format validation (Indian)
- Email format validation
- PIN code validation
- Registration number required for facilities

## 🆘 Support

For issues or questions, check:
1. Console for errors
2. Network tab for API responses
3. Validation messages in form

## 📈 Future Enhancements

- File upload for documents
- Image upload for facility photos
- Real-time validation
- Save draft functionality
- Multi-language support

---

**Version**: 2.0.0  
**Last Updated**: December 2024

Built with ❤️ for healthcare professionals 🏥
