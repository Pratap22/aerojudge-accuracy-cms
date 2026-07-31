# AeroJudge

**Developed by:** Nepalabs

**Tagline:**
Professional Competition Management Platform for Air Sports

## Mission

AeroJudge is a commercial SaaS platform designed to manage air sports competitions from registration through official results.

The first supported discipline is Paragliding Accuracy.

The platform is designed to support multiple organizations, multiple competitions, and future air sports.

## Initial Release

Version 1 targets Paragliding Accuracy competitions following the FAI Sporting Code Section 7C.

## Future Expansion

- Hang Gliding Accuracy
- XC Competitions
- Aerobatics
- Powered Paragliding
- Drone Competitions

## Philosophy

AeroJudge is not just a scoring system.

It is an Event Operating System.

Everything should be configurable.

Nothing should be organization-specific.

## Organizations

An **Organization** is the multi-tenant root: federations, clubs, and commercial customers own competitions and hold branding, contact data, plan limits, and default rule/print/display settings.

Examples (configurable data — not product branding):

- Nepal Paragliding & Hang Gliding Association (sample seed tenant)
- Fédération Aéronautique Internationale (FAI)
- Hang Gliding Federation of India
- Local clubs and future commercial customers

**Competitions** always belong to an organization (`organizationId`). Pilots, teams, sponsors, documents, certificates, and reports remain competition-scoped and are reached through the owning organization.

Product branding remains **AeroJudge** by **Nepalabs**. Organization names and logos are tenant configuration managed in Admin → Organizations.
