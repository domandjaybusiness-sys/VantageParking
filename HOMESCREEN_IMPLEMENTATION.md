# HomeScreen Interactive Implementation

## Overview
The HomeScreen now has fully interactive UI elements with real navigation and location services.

## Features Implemented

### 1. **Search a Location Button**
- **Action**: Navigates to Map tab and automatically opens the search input modal
- **Implementation**: Uses expo-router with query param `?openSearch=true`
- **User Flow**: Home → Map (with search modal open)

### 2. **Use My Current Location Button**
- **Action**: Requests location permission, gets GPS coordinates, and navigates to Map centered on user location
- **Implementation**: 
  - Uses `expo-location` for permission handling and GPS
  - Handles permission denial with alert + settings link
  - Passes coordinates via route params: `/map?lat={lat}&lng={lng}`
- **User Flow**: 
  - Permission granted → Home → Map (centered on user location)
  - Permission denied → Alert with "Open Settings" option

### 3. **How It Works Card**
- **Action**: Opens a bottom sheet modal explaining the 3-step process
- **Implementation**: 
  - Pressable card wrapper
  - Modal with numbered steps and descriptions
  - "Got it" button to dismiss
- **Content**:
  1. Search - Find available parking near your destination
  2. Reserve - Book your spot instantly and pay securely
  3. Park - Arrive and park with confidence

### 4. **Empty State (when no spots found)**
- **Condition**: Shows when `drivewaysFound === 0`
- **Primary CTA**: "Become a Host" → Navigates to Host tab (`/host`)
- **Secondary CTA**: "Search another city" text link → Same as "Search a location"

## Technical Details

### Dependencies Added
- **expo-location**: `~18.0.5` (added to package.json)

### Files Modified
1. **`app/(tabs)/index.tsx`**
   - Added navigation handlers
   - Integrated expo-location
   - Added modal state and UI
   - Implemented permission handling

2. **`app/(tabs)/map.tsx`**
   - Added `useLocalSearchParams` to handle route params
   - Auto-opens search modal when `openSearch=true`
   - Auto-centers map when `lat` and `lng` params provided

3. **`package.json`**
   - Added `expo-location` dependency

## Testing Instructions

### Install Dependencies
```bash
npm install
# or
yarn install
```

### Run the App
```bash
npx expo start
```

### Test Scenarios

#### 1. Test "Search a Location"
- Tap "Search a location" button
- Should navigate to Map tab
- Search modal should open automatically

#### 2. Test "Use My Current Location"
- Tap "Use my current location" button
- Grant location permission when prompted
- Should navigate to Map tab
- Map should center on your current GPS coordinates

#### 3. Test Permission Denial
- Reset location permissions in device settings
- Tap "Use my current location" button
- Deny permission
- Should show alert with "Open Settings" option
- Tap "Open Settings" to verify it opens device settings

#### 4. Test "How It Works"
- Tap the "How it works" card
- Bottom sheet should slide up
- Verify 3 steps are displayed correctly
- Tap "Got it" to dismiss

#### 5. Test Empty State
- (When driveways count is 0)
- Verify "No spots in this area yet" message
- Tap "Become a Host" → should navigate to Host tab
- Tap "Search another city" → should navigate to Map with search open

## Navigation Architecture

```
HomeScreen
├── Search a location → /map?openSearch=true
├── Use current location → /map?lat={lat}&lng={lng}
├── How it works → Modal (internal state)
└── Empty State
    ├── Become a Host → /host
    └── Search another city → /map?openSearch=true
```

## Platform Considerations

### iOS
- Uses `app-settings:` URL scheme to open settings
- Location permission prompt is native

### Android
- Uses `Linking.openSettings()` to open app settings
- Location permission prompt is native

### Web
- Location services may require HTTPS
- Browser-specific permission UI

## Future Enhancements
- [ ] Add loading indicator during location fetch
- [ ] Cache last searched location
- [ ] Add "Recent searches" to search modal
- [ ] Implement spot filtering based on current location radius
- [ ] Add haptic feedback on button presses
