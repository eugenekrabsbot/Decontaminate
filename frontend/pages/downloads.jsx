import Head from '../components/Head';
import Card from '../components/ui/Card';

const DOWNLOADS = [
  {
    platform: '🪟 Windows',
    description: 'VPN client for Windows 10/11 with automatic updates and trusted certificates.',
    tagline: 'Full desktop VPN client for Windows.',
    buttonText: 'Download .exe',
    href: 'https://vpnclient.app/current/vpnclient/vpnclient.exe',
    details: ['Windows 10/11', 'Automatic updates', 'Trusted certificates'],
  },
  {
    platform: '🍎 macOS',
    description: 'VPN client for Apple Mac with support for Apple silicon and Intel chips.',
    tagline: 'System-level VPN tunnel for macOS.',
    buttonText: 'Download .dmg',
    href: 'https://vpnclient.app/current/vpnclient/vpnclient.dmg',
    details: ['Apple silicon & Intel', 'macOS compatible', 'Easy installation'],
  },
  {
    platform: '🤖 Android',
    description: 'VPN client for Android phones and tablets via Google Play Store.',
    tagline: 'Install from Google Play Store.',
    buttonText: 'View on Google Play',
    href: 'https://play.google.com/store/apps/details?id=com.vpn.client',
    details: ['Google Play Store', 'Android phones & tablets', 'Automatic updates'],
  },
  {
    platform: '📺 Firestick & Android TV',
    description: 'VPN client optimized for Firestick and Android TV devices.',
    tagline: 'TV-optimized VPN client.',
    buttonText: 'Download APK',
    href: 'https://vpnclient.app/apk/VPNClient-TV.apk',
    details: ['Firestick compatible', 'Android TV', 'TV-optimized interface'],
  },
  {
    platform: '🍎 iPhone',
    description: 'VPN client for iPhone via Apple App Store.',
    tagline: 'iOS VPN client from App Store.',
    buttonText: 'View on App Store',
    href: 'https://apps.apple.com/us/app/vpnclient-secured-vpn/id1506797696',
    details: ['Apple App Store', 'iPhone compatible', 'iOS 16+'],
  },
];

export default function DownloadsPage() {
  return (
    <div style={styles.page}>
      <Head page="downloads" />
      <section style={styles.hero}>
        <p style={styles.label}>Download VPN Client</p>
        <h1 style={styles.title}>Get VPN Client on Every Platform</h1>
        <p style={styles.subtitle}>
          Download our VPN client for Windows, Mac, Android, iOS, and Firestick/Android TV. Click the button below to get started.
        </p>
        <p style={styles.note}>
          Need help with installation? Check our FAQ or contact support for assistance.
        </p>
      </section>

      <section style={styles.grid}>
        {DOWNLOADS.map((item) => (
          <Card key={item.platform} padding="1.5rem" style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.platform}>{item.platform}</h3>
              <p style={styles.tagline}>{item.tagline}</p>
            </div>
            <p style={styles.description}>{item.description}</p>
            <ul style={styles.details}>
              {item.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
            <div style={styles.cardFooter}>
              <a
                href={item.href}
                target={item.href.startsWith('mailto:') ? undefined : '_blank'}
                rel="noreferrer"
                style={styles.link}
              >
                {item.buttonText}
              </a>
            </div>
          </Card>
        ))}
      </section>

      <Card padding="1.25rem" style={styles.routerCard}>
        <h3 style={{ marginTop: 0 }}>Want a router config?</h3>
        <p style={{ marginBottom: 0 }}>
          Reach out to <a href="mailto:ahoyvpn@ahoyvpn.net" style={{ color: '#1E90FF' }}>ahoyvpn@ahoyvpn.net</a>
        </p>
      </Card>
    </div>
  );
}

const styles = {
  page: {
    width: '100%',
    marginTop: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2.5rem',
  },
  hero: {
    textAlign: 'center',
    maxWidth: '800px',
    margin: '0 auto',
  },
  label: {
    color: '#66D9EF',
    letterSpacing: '0.2em',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '2.5rem',
    color: '#FFFFFF',
    marginBottom: '1rem',
  },
  subtitle: {
    color: '#B0C4DE',
    fontSize: '1.1rem',
    marginBottom: '0.75rem',
  },
  note: {
    color: '#8AB4F8',
    fontSize: '0.95rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    minHeight: '260px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardHeader: {
    marginBottom: '1rem',
  },
  platform: {
    margin: 0,
    fontSize: '1.4rem',
    color: '#FFFFFF',
  },
  tagline: {
    color: '#B0C4DE',
    margin: '0.25rem 0 0',
    fontSize: '0.9rem',
  },
  description: {
    color: '#B7C6D9',
    fontSize: '0.95rem',
    lineHeight: '1.6',
  },
  details: {
    margin: '1rem 0',
    color: '#9FB0C6',
    paddingLeft: '1.2rem',
    lineHeight: '1.6',
  },
  cardFooter: {
    marginTop: 'auto',
  },
  link: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#1E90FF',
    color: '#FFFFFF',
    padding: '0.7rem 1rem',
    borderRadius: '4px',
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'background-color 0.3s ease',
  },
  routerCard: {
    border: '1px solid rgba(30, 144, 255, 0.3)',
    backgroundColor: 'rgba(30, 144, 255, 0.08)'
  },
};
