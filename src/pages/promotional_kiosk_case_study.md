
# Case Study: Promotional Kiosk Progressive Web App for Sitebulb  
**An Offline-First, Touch-Optimized Experience for Conference Demos**

## The Problem

Sitebulb required a reliable and engaging way to promote its features and product functionality at industry conferences and trade shows. The solution needed to support a combination of video demos and slides, function seamlessly on tablets and touchscreen TVs, and work **fully offline** due to unreliable venue internet connections and the need to serve high-resolution media assets.

---

## The Solution

A **progressive web application (PWA)** was developed to address these needs, offering a robust and interactive experience on various touch-enabled devices without any internet dependency.

### Key Features

- **Offline-First Architecture**  
  Designed to run without a network connection, the app preloads all video content and slides for uninterrupted playback and presentation.

- **Touchscreen Optimization**  
  The interface was designed with large targets and minimal UI clutter for a seamless experience on tablets and large touchscreen displays.

- **Video Playback System**  
  A custom HTML5 video player was built using React components to manage:
  - A flexible video playlist
  - Custom title cards before each video
  - Pause and resume functionality for smooth user control

- **Presentation Deck Mode**  
  The application supports slide-based presentations showcasing:
  - Key product features
  - Competitor comparisons
  - QR codes for instant free trial downloads

- **Kiosk Mode Integration**  
  The app was deployed via **Fully Kiosk Browser** on Android tablets, allowing the device to be locked into a secure, single-app experience during conferences.

---

## Technologies Used

| Stack Area        | Tools & Frameworks                      |
|-------------------|------------------------------------------|
| **Frontend**      | Typescript, React, Tailwind CSS          |
| **Deployment**    | Fully Kiosk Browser (Android)            |
| **Media Handling**| Custom HTML5 video player components     |

---

## Future Enhancements

There are plans to integrate with **Calendly** to allow event attendees to schedule private demos—especially targeting Sitebulb’s premium cloud offering. This enhancement will further extend the kiosk's utility from a passive promotional tool to an active lead generation channel.

---

## Impact

The kiosk web app provided a highly engaging and stable solution for event teams, eliminating dependency on venue internet and allowing Sitebulb to deliver polished, interactive demos and marketing material with confidence. It also laid the groundwork for additional lead-capture capabilities in the future.

---
