interface ExamInstructionsProps {
    onStart: () => void;
  }
  
  function ExamInstructions({ onStart }: ExamInstructionsProps) {
    return (
      <div>
        <h1>Exam Instructions</h1>
  
        <p>Please read the following instructions carefully.</p>
  
        <ul>
          <li>The exam contains 5 questions.</li>
          <li>You have 5 minutes to complete the exam.</li>
          <li>Once the exam starts, the timer cannot be paused.</li>
          <li>Make sure you have a stable internet connection.</li>
          <li>When the time expires, the exam will be submitted automatically.</li>
        </ul>
  
        <button onClick={onStart}>
          Start Exam
        </button>
      </div>
    );
  }
  
  export default ExamInstructions;