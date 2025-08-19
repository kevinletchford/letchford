
# Case Study: Article Automation for Sitebulb  
**Streamlining the Editorial Pipeline from Google Docs to CMS in Minutes**

## The Problem

At Sitebulb, a significant portion of blog content was sourced from guest contributors who submitted drafts via Google Docs. Converting these raw documents into fully-published blog posts was a highly manual, time-consuming process. It involved:

- Copying and formatting content for the CMS  
- Extracting and uploading images  
- Pulling out quotes and embeds  
- Creating author pages  
- Generating social share images  
- Adding jump links and related content manually

This process took up to **2 hours per article**, which was not scalable for a growing content strategy. The goal was to design and build a system to **automate and accelerate** this entire pipeline.

---

## The Solution

A **custom admin interface** was developed to take a Google Docs URL and turn it into a structured, CMS-ready article in a matter of minutes.

### Key Features

- **Google Docs Parsing**  
  The user enters a Google Docs URL into the admin tool. Using Google Auth and the Google Docs + Drive APIs, the tool reads and processes the document contents.

- **Content Extraction & Processing**  
  The parser loops through all document elements:
  - Extracts structured content (headings, body, images, quotes)
  - Caches and downloads inline images
  - Pulls metadata such as authorship and embeds
  - Strips out meta tags and unsupported formatting

- **Custom Admin Interface**  
  Built with **Vite**, **Typescript**, **React**, **Shadcn**, **React Query**, and **Tailwind**, the interface previews all parsed content for review and modification before publishing.

- **Dynamic Publishing Logic**  
  Once approved, the system:
  - Creates new CMS entries if they don't already exist (e.g. authors, tags)
  - Associates new content with existing references when available
  - Transitions from manual jump link generation to JavaScript-powered embedding based on `<h2>` and `<h3>` elements

- **Smart Related Content**  
  Hand-curated related articles were replaced with **tag-driven automation**, improving editorial speed while maintaining relevance.

- **Social Share Image Generation**  
  Using **Playwright**, the system auto-generates social images based on the article title, meta description, and thumbnail image.

- **Illustration Workflow**  
  At the time of implementation, **Sora** (without a public API) was used to create thumbnails via manual prompting. Other AI alternatives were evaluated but did not meet quality standards.

---

## Technologies Used

| Stack Area           | Tools & Frameworks                                     |
|----------------------|--------------------------------------------------------|
| **Frontend**         | Vite, Typescript, React, Shadcn, React Query, Tailwind |
| **Backend / CMS**    | Umbraco (C#), custom APIs                              |
| **Automation**       | Google Docs & Drive APIs, Google Auth                  |
| **Testing / Assets** | Playwright (tests + image automation)                  |

---

## Impact

This solution reduced editorial production time by **over 85%**—from approximately 2 hours down to **just 15 minutes per article**.

The automation not only saved time but also improved content consistency, ensured better SEO hygiene (thanks to structured metadata), and allowed the content team to focus more on quality and strategy rather than tedious formatting.

---
