# Project Architecture

## Overview
This project follows a modular, scalable architecture with clear separation of concerns.

## Folder Structure

### `/src/components/`
Contains all React components. Each component has its own CSS file.

**Component List:**
- `Header.js` - App header with logo and theme toggle (89 lines)
- `UserTypeSelector.js` - User type selection cards (50 lines)
- `FormInput.js` - Reusable text input component (52 lines)
- `FormSelect.js` - Reusable dropdown component (52 lines)
- `AddressSection.js` - Address form section (56 lines)
- `DoctorSection.js` - Doctor-specific fields (44 lines)
- `RegistrationForm.js` - Main form logic (160 lines)
- `SubmitButton.js` - Submit button with states (38 lines)
- `SuccessModal.js` - Success notification modal (30 lines)
- `Footer.js` - App footer (18 lines)

**All components are under 400 lines as required.**

### `/src/constants/`
Centralized configuration and static data.

**Files:**
- `theme.js` - Light and dark theme color definitions
- `typography.js` - Font families, sizes, weights, line heights
- `appConstants.js` - App config, user types, states, specializations, validation patterns

### `/src/context/`
React Context providers for global state.

**Files:**
- `ThemeContext.js` - Theme management (dark/light mode) with localStorage persistence

### `/src/utils/`
Utility functions and helpers.

**Files:**
- `validation.js` - Form validation logic separated from components

### `/src/styles/` (Component-level CSS)
Each component has its own CSS file for styling isolation.

## Key Features

### 1. Theme System
- **Implementation**: Context API
- **Storage**: localStorage
- **Dynamic**: CSS variables updated in real-time
- **Toggle**: Button in header

### 2. Centralized Constants
- **Colors**: All theme colors in `theme.js`
- **Typography**: All font settings in `typography.js`
- **Data**: All static data (states, specializations) in `appConstants.js`

### 3. Modular Components
- Each component < 400 lines
- Single responsibility principle
- Reusable and testable
- Clear prop interfaces

### 4. Validation System
- Separated validation logic in `utils/validation.js`
- Centralized error messages in `appConstants.js`
- Consistent validation patterns

## Component Communication

```
App.js (ThemeProvider)
  └── Header (theme toggle)
  └── RegistrationForm (form state)
      ├── UserTypeSelector
      ├── FormInput (name)
      ├── FormInput (contact)
      ├── AddressSection
      │   ├── FormInput (city)
      │   ├── FormSelect (state)
      │   └── FormInput (pinCode)
      ├── DoctorSection (conditional)
      │   ├── FormSelect (specialization)
      │   └── FormInput (experience)
      ├── SubmitButton
      └── SuccessModal
  └── Footer
```

## State Management

### Local State (Component Level)
- Form data in `RegistrationForm`
- Form errors in `RegistrationForm`
- Focus state in input components

### Global State (Context)
- Theme mode (dark/light) in `ThemeContext`

## Styling Strategy

### CSS Variables
- All colors, fonts, sizes defined as CSS variables
- Updated dynamically by ThemeContext
- Consistent across all components

### Component-Level CSS
- Each component has its own CSS file
- Scoped styles prevent conflicts
- Easy to maintain and update

## Data Flow

1. **User Input** → Component onChange handler
2. **State Update** → RegistrationForm state
3. **Validation** → utils/validation.js
4. **Error Display** → Component error prop
5. **Submit** → API call with formData
6. **Success** → SuccessModal display

## Best Practices

### Components
- Props typed with destructuring
- Default props where appropriate
- Focused, single-purpose components
- Accessibility considerations

### Constants
- All magic strings/numbers in constants
- Easy to update in one place
- Type safety through imports

### Styling
- CSS variables for theming
- Mobile-first responsive design
- Consistent spacing and sizing
- Smooth transitions

### Performance
- Framer Motion for optimized animations
- Conditional rendering where appropriate
- Minimal re-renders

## Adding New Features

### Add a New Form Field
1. Add field to form state in `RegistrationForm`
2. Add validation in `utils/validation.js`
3. Add error message in `appConstants.js`
4. Create/reuse appropriate component

### Add a New Theme
1. Define colors in `constants/theme.js`
2. ThemeContext will handle switching
3. CSS variables update automatically

### Add New Static Data
1. Add to `constants/appConstants.js`
2. Import where needed
3. Use in component dropdowns/options

## Code Quality

- **Modular**: Easy to test individual components
- **Maintainable**: Clear structure and naming
- **Scalable**: Easy to add new features
- **Readable**: Well-commented and documented
- **Consistent**: Follows React best practices

## Performance Optimizations

- Lazy loading potential for future routes
- Memoization opportunities for expensive calculations
- Optimized re-renders through proper state management
- CSS animations over JavaScript where possible

---

**Last Updated**: December 2024  
**Architecture Version**: 2.0
