import type { ReactNode } from 'react';
import { isEmptyHtml, type CompetitionEventInfo } from '@npha/shared';
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { osmBrowseUrl, osmEmbedUrl, sanitizePublicHtml } from '../lib/rich-html';

function InfoSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-white/10 py-12 first:border-t-0 first:pt-0">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function RichHtml({ html }: { html: string }) {
  const clean = sanitizePublicHtml(html);
  if (!clean) return null;
  return (
    <div
      className="rich-html max-w-3xl text-[15px] leading-relaxed text-sky-100/75 [&_a]:text-sky-300 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-sky-200 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-sky-100 [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-sky-50 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

interface CompetitionInfoSectionsProps {
  info: CompetitionEventInfo;
}

export function CompetitionInfoSections({ info }: CompetitionInfoSectionsProps) {
  const sections: Array<{ id: string; title: string; html: string | null }> = [
    { id: 'about', title: 'About', html: info.aboutHtml },
    { id: 'schedule', title: 'Daily schedule', html: info.dailyScheduleHtml },
    { id: 'selection', title: 'Selection rules', html: info.selectionRulesHtml },
    { id: 'fees', title: 'Entry fee payment', html: info.entryFeePaymentHtml },
    { id: 'flying-site', title: 'Flying site', html: info.flyingSiteHtml },
    { id: 'travel', title: 'Travel info', html: info.travelInfoHtml },
  ];

  const hasMap = info.latitude != null && info.longitude != null;
  const hasGallery = info.gallery.length > 0;
  const hasLinks = info.links.length > 0;
  const hasContacts = info.contacts.length > 0;

  const visibleRich = sections.filter((s) => !isEmptyHtml(s.html));
  if (
    visibleRich.length === 0 &&
    !hasMap &&
    !hasGallery &&
    !hasLinks &&
    !hasContacts
  ) {
    return null;
  }

  return (
    <div>
      {visibleRich.map((section) => (
        <InfoSection key={section.id} id={section.id} title={section.title}>
          <RichHtml html={section.html!} />
        </InfoSection>
      ))}

      {hasGallery ? (
        <InfoSection id="gallery" title="Gallery">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {info.gallery.map((image) => (
              <figure
                key={image.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
              >
                <img
                  src={image.url}
                  alt={image.caption ?? ''}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
                {image.caption ? (
                  <figcaption className="px-3 py-2 text-sm text-sky-100/55">
                    {image.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </InfoSection>
      ) : null}

      {hasMap ? (
        <InfoSection id="map" title="Event map">
          <div className="overflow-hidden rounded-xl border border-white/10">
            <iframe
              title="Event map"
              className="h-72 w-full border-0 sm:h-96"
              src={osmEmbedUrl(info.latitude!, info.longitude!, info.mapZoom ?? 13)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-sky-100/65">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-sky-400/60" />
                {info.mapLabel || info.location || info.venue}
              </span>
              <a
                href={osmBrowseUrl(info.latitude!, info.longitude!, info.mapZoom ?? 13)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200"
              >
                Open in OpenStreetMap
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </InfoSection>
      ) : null}

      {hasLinks ? (
        <InfoSection id="links" title="Links">
          <ul className="max-w-2xl space-y-2">
            {info.links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sky-100 transition-colors hover:border-sky-500/30 hover:bg-white/[0.07] hover:text-white"
                >
                  <ExternalLink className="h-4 w-4 shrink-0 text-sky-400/60" />
                  <span>{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </InfoSection>
      ) : null}

      {hasContacts ? (
        <InfoSection id="contacts" title="Contacts">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {info.contacts.map((contact) => (
              <article
                key={contact.id}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-5"
              >
                <h3 className="font-semibold text-sky-100">{contact.name}</h3>
                <p className="mt-1 text-sm text-sky-100/50">{contact.role}</p>
                <div className="mt-4 space-y-2 text-sm text-sky-100/70">
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-2 hover:text-sky-300"
                    >
                      <Phone className="h-3.5 w-3.5 text-sky-400/50" />
                      {contact.phone}
                    </a>
                  ) : null}
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 hover:text-sky-300"
                    >
                      <Mail className="h-3.5 w-3.5 text-sky-400/50" />
                      <span className="truncate">{contact.email}</span>
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </InfoSection>
      ) : null}
    </div>
  );
}
