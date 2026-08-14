# Fractal Media Infrastructure Pages Site

This repository is the static GitHub Pages front door for Fractal Media Infrastructure.

It is designed to present the organization as the umbrella public-interest entity behind:

- `instance001` as the open R&D lab and GitHub ecosystem
- `Let's Rethink AI` as the media and public education branch

## Purpose

This site exists to provide a clear public-facing organizational surface for:

- app store listings and support links
- grant or fellowship reviewers
- collaborators and institutions
- general public orientation

## Structure

- `index.html` - homepage / organizational front door
- `about.html` - mission and operating stance
- `branches.html` - explanation of FMI, instance001, and Let's Rethink AI
- `projects.html` - selected active project lanes
- `public-record.html` - external public records, indexes, ORCID/PhilPapers profiles, source links, and release surfaces
- `ai-fair-go.html` - Australian AI Fair-Go policy companion page
- `independent-convergence.html` - selective evidence page for parallel public development
- `stewardship.html` - funding, independence, and stewardship stance
- `contact.html` - public contact and support information
- `app-support.html` - app store oriented support and contact page
- `assets/` - site images and brand assets
- `data/public-record.json` - source data for the generated public record page
- `scripts/generate-public-record.mjs` - generates `public-record.html` from the public record manifest
- `styles.css` - shared visual system
- `GLOSSARY.md` - local glossary excerpt for this repo's public-site terms

## Publishing

This repo is intended to be published as the account Pages site:

- repository name: `instance001.github.io`
- source: branch root

An empty `.nojekyll` file is included so GitHub Pages serves the static files directly.

## Generated Surfaces

The public record page is generated from `data/public-record.json`.

To update public record entries:

1. Edit `data/public-record.json`.
2. Run `node scripts/generate-public-record.mjs --check-links`.
3. Run `node scripts/generate-seo.mjs` to refresh the public record, repo atlas, and sitemaps together.
