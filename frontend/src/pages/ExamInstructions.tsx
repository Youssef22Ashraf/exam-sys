import { ExamStorage } from "../services/storage";

interface ExamInstructionsProps {
  onStart: () => void;
}

function ExamInstructions({ onStart }: ExamInstructionsProps) {
  const settings = ExamStorage.getSettings();
  const questions = ExamStorage.getQuestions();

  return (
    <main className="page-container">
      <div style={{ textAlign: "center" }}>
        <div
          className="company-logo-badge"
          style={{
            height: "56px",
            padding: "6px 16px",
            margin: "0 auto 14px auto",
            borderRadius: "10px",
          }}
          title="Mofarreh Group — Engineering & Construction"
        >
          <img
            src="/mofarreh-logo.png"
            alt="Mofarreh Group Logo"
            style={{ height: "42px", width: "auto" }}
          />
        </div>
        <h1 className="page-title">Examination Instructions</h1>

        <p className="page-description">
          Mofarreh Group Assessment • Please read the following information carefully before starting.
        </p>
      </div>

      <div
        className="card"
        style={{
          maxWidth: "760px",
          margin: "30px auto 0",
          padding: "35px",
        }}
      >
        <h2>Before You Begin</h2>

        <div className="instruction-list">
          <div>
            <strong>01</strong>
            <span>
              The examination contains <b>{questions.length} questions</b> across
              Interface Management and Stakeholder Management.
            </span>
          </div>

          <div>
            <strong>02</strong>
            <span>
              You have <b>{settings.durationMinutes} minutes</b> to complete the
              examination.
            </span>
          </div>

          <div>
            <strong>03</strong>
            <span>
              Passing score threshold is <b>{settings.passingPercentage}%</b>.
            </span>
          </div>

          <div>
            <strong>04</strong>
            <span>
              Once the examination starts, the timer cannot be paused.
            </span>
          </div>

          <div>
            <strong>05</strong>
            <span>
              The examination will be submitted automatically when the time
              expires.
            </span>
          </div>

          <div>
            <strong>06</strong>
            <span>
              Make sure you have a stable internet connection before starting.
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: "30px",
            paddingTop: "25px",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <button
            className="primary-button"
            onClick={onStart}
            style={{ width: "100%" }}
          >
            Start Examination →
          </button>
        </div>
      </div>
    </main>
  );
}

export default ExamInstructions;