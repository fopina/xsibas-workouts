const Landing = ({ onGetStarted }) => {
  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2em 1em',
      textAlign: 'center'
    }}>
      {/* App Icon/Logo */}
      <div style={{
        marginBottom: '0.5em'
      }}>
        <img
          src="/xsibas300.png"
          alt="XSibas Logo"
          style={{
            width: '100px',
            height: '100px',
            objectFit: 'contain'
          }}
        />
      </div>

      {/* App Title */}
      <h1 style={{
        fontSize: '2.5em',
        marginBottom: '0.5em',
        color: '#8bc34a'
      }}>
        XSibas Workout Planner
      </h1>

      {/* Tagline */}
      <p style={{
        fontSize: '1.2em',
        color: '#aaa',
        marginBottom: '2em'
      }}>
        Your personal workout tracker powered by Google Sheets
      </p>

      {/* Key Features */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5em',
        marginBottom: '3em',
        textAlign: 'left'
      }}>
        <div style={{
          padding: '1.5em',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <div style={{ fontSize: '2em', marginBottom: '0.5em' }}>📅</div>
          <h3 style={{ color: '#8bc34a', marginBottom: '0.5em' }}>Calendar Views</h3>
          <p style={{ color: '#aaa', fontSize: '0.9em' }}>
            View your workouts in weekly or monthly calendar format
          </p>
        </div>

        <div style={{
          padding: '1.5em',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <div style={{ fontSize: '2em', marginBottom: '0.5em' }}>📝</div>
          <h3 style={{ color: '#8bc34a', marginBottom: '0.5em' }}>Workout Notes</h3>
          <p style={{ color: '#aaa', fontSize: '0.9em' }}>
            Add notes to track your progress and performance
          </p>
        </div>

        <div style={{
          padding: '1.5em',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <div style={{ fontSize: '2em', marginBottom: '0.5em' }}>🎥</div>
          <h3 style={{ color: '#8bc34a', marginBottom: '0.5em' }}>Exercise Videos</h3>
          <p style={{ color: '#aaa', fontSize: '0.9em' }}>
            Watch instructional videos directly from your workout plan
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '2em',
        borderRadius: '8px',
        border: '1px solid #333',
        marginBottom: '2em',
        textAlign: 'left'
      }}>
        <h2 style={{ color: '#8bc34a', marginBottom: '1em', textAlign: 'center' }}>
          How It Works
        </h2>
        <ol style={{
          color: '#aaa',
          lineHeight: '1.8',
          paddingLeft: '1.5em'
        }}>
          <li>Create your workout plan in Google Sheets</li>
          <li>Sign in with your Google account</li>
          <li>Connect your workout spreadsheet</li>
          <li>View and track your workouts with a beautiful interface</li>
        </ol>
      </div>

      {/* CTA Button */}
      <button
        onClick={onGetStarted}
        style={{
          fontSize: '1.2em',
          padding: '1em 2.5em',
          backgroundColor: '#8bc34a',
          color: '#000',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          transition: 'transform 0.2s, box-shadow 0.2s',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
        }}
      >
        Get Started
      </button>

      {/* Privacy Note */}
      <p style={{
        marginTop: '2em',
        fontSize: '0.85em',
        color: '#666',
        maxWidth: '600px',
        margin: '2em auto 0'
      }}>
        We only access spreadsheets you explicitly share with us.
        Your data stays in your Google Drive.
        Read our <a href="/privacy/" style={{ color: '#8bc34a', textDecoration: 'none' }}>privacy policy</a>.
      </p>
    </div>
  );
};

export default Landing;
