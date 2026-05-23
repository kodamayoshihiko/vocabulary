import { updateWordStats, getEverWrongWordIds } from './storage';

export interface QuizQuestion {
  id: string;
  word: string;
  pos: string;
  answer: string;
  choices: string[];
}

export type ScreenState = 'HOME' | 'NO_WRONG_WORDS' | 'QUIZ' | 'FEEDBACK' | 'RESULT';

export class VocabApp {
  private allQuestions: QuizQuestion[] = [];
  private sessionQuestions: QuizQuestion[] = [];
  private shuffledChoices: string[] = []; // Shuffled choices for current question
  private currentQuestionIndex = 0;
  
  // Scoring & session tracking
  private score = 0;
  private wrongQuestionsInSession: QuizQuestion[] = [];
  private lastAnswerWasCorrect = false;

  // Screen states
  private screenState: ScreenState = 'HOME';
  
  // Menu navigation
  private homeMenuIndex = 0; // 0: New 20, 1: Wrong 20
  private quizChoiceIndex = 0; // 0-3 for choices A, B, C, D
  private resultMenuIndex = 0; // 0: Retry wrong, 1: Home

  // Callback to trigger re-renders
  private onStateChange: () => void = () => {};

  constructor() {}

  public bindStateChange(callback: () => void) {
    this.onStateChange = callback;
  }

  public async init() {
    try {
      const response = await fetch('/oxford_5000_quiz.json');
      if (!response.ok) {
        throw new Error(`Failed to load quiz data: ${response.statusText}`);
      }
      this.allQuestions = await response.json();
    } catch (e) {
      console.error(e);
      this.allQuestions = [];
    }
    this.goToHome();
  }

  // --- State Getters for Diagnostics ---
  public getScreenState(): ScreenState {
    return this.screenState;
  }

  public getSessionProgress(): string {
    if (this.screenState === 'QUIZ' || this.screenState === 'FEEDBACK') {
      const current = String(this.currentQuestionIndex + 1).padStart(2, '0');
      const total = String(this.sessionQuestions.length).padStart(2, '0');
      return `${current}/${total}`;
    }
    return '0/0';
  }

  public getScoreText(): string {
    return `${this.score}/${this.sessionQuestions.length}`;
  }

  public getAllQuestionsCount(): number {
    return this.allQuestions.length;
  }

  // --- Navigation & Actions ---
  public handleSwipeUp() {
    switch (this.screenState) {
      case 'HOME':
        this.homeMenuIndex = this.homeMenuIndex === 0 ? 1 : 0;
        break;
      case 'QUIZ':
        // Move choice up (0 -> 3 -> 2 -> 1 -> 0)
        this.quizChoiceIndex = (this.quizChoiceIndex - 1 + 4) % 4;
        break;
      case 'RESULT':
        // Only if not perfect (which shows Retry wrong and Home)
        if (this.score < this.sessionQuestions.length) {
          this.resultMenuIndex = this.resultMenuIndex === 0 ? 1 : 0;
        }
        break;
    }
    this.onStateChange();
  }

  public handleSwipeDown() {
    switch (this.screenState) {
      case 'HOME':
        this.homeMenuIndex = this.homeMenuIndex === 0 ? 1 : 0;
        break;
      case 'QUIZ':
        // Move choice down
        this.quizChoiceIndex = (this.quizChoiceIndex + 1) % 4;
        break;
      case 'RESULT':
        if (this.score < this.sessionQuestions.length) {
          this.resultMenuIndex = (this.resultMenuIndex + 1) % 2;
        }
        break;
    }
    this.onStateChange();
  }

  public handleClick() {
    switch (this.screenState) {
      case 'HOME':
        if (this.homeMenuIndex === 0) {
          this.startNew20Session();
        } else {
          this.startWrong20Session();
        }
        break;

      case 'NO_WRONG_WORDS':
        this.goToHome();
        break;

      case 'QUIZ':
        this.submitAnswer();
        break;

      case 'FEEDBACK':
        this.nextQuestion();
        break;

      case 'RESULT':
        if (this.score === this.sessionQuestions.length) {
          // Perfect score, only Home is available
          this.goToHome();
        } else {
          if (this.resultMenuIndex === 0) {
            this.startRetryWrongSession();
          } else {
            this.goToHome();
          }
        }
        break;
    }
    this.onStateChange();
  }

  public handleDoubleClick() {
    this.goToHome();
    this.onStateChange();
  }

  // --- Game Flow Helper Methods ---
  private goToHome() {
    this.screenState = 'HOME';
    this.homeMenuIndex = 0;
  }

  private startNew20Session() {
    if (this.allQuestions.length === 0) return;
    
    // Select up to 10 random unique questions
    const shuffled = [...this.allQuestions].sort(() => Math.random() - 0.5);
    this.sessionQuestions = shuffled.slice(0, Math.min(10, shuffled.length));
    
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.wrongQuestionsInSession = [];
    this.setupCurrentQuestion();
  }

  private startWrong20Session() {
    const wrongIds = getEverWrongWordIds();
    const wrongPool = this.allQuestions.filter((q) => wrongIds.includes(q.id));

    if (wrongPool.length === 0) {
      this.screenState = 'NO_WRONG_WORDS';
      return;
    }

    const shuffled = [...wrongPool].sort(() => Math.random() - 0.5);
    this.sessionQuestions = shuffled.slice(0, Math.min(10, shuffled.length));
    
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.wrongQuestionsInSession = [];
    this.setupCurrentQuestion();
  }

  private startRetryWrongSession() {
    if (this.wrongQuestionsInSession.length === 0) {
      this.goToHome();
      return;
    }

    // Retry only the wrong questions from this session
    // Shuffle them so they aren't in the exact same order
    this.sessionQuestions = [...this.wrongQuestionsInSession].sort(() => Math.random() - 0.5);
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.wrongQuestionsInSession = [];
    this.setupCurrentQuestion();
  }

  private setupCurrentQuestion() {
    if (this.currentQuestionIndex >= this.sessionQuestions.length) {
      this.screenState = 'RESULT';
      this.resultMenuIndex = 0;
      return;
    }

    const currentQuestion = this.sessionQuestions[this.currentQuestionIndex];
    // Shuffle choices using Fisher-Yates algorithm
    this.shuffledChoices = [...currentQuestion.choices];
    for (let i = this.shuffledChoices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledChoices[i], this.shuffledChoices[j]] = [this.shuffledChoices[j], this.shuffledChoices[i]];
    }

    this.quizChoiceIndex = 0;
    this.screenState = 'QUIZ';
  }

  private submitAnswer() {
    const currentQuestion = this.sessionQuestions[this.currentQuestionIndex];
    const selectedAnswer = this.shuffledChoices[this.quizChoiceIndex];
    
    this.lastAnswerWasCorrect = (selectedAnswer === currentQuestion.answer);

    if (this.lastAnswerWasCorrect) {
      this.score += 1;
    } else {
      this.wrongQuestionsInSession.push(currentQuestion);
    }

    // Save statistics in localStorage
    updateWordStats(currentQuestion.id, this.lastAnswerWasCorrect);

    this.screenState = 'FEEDBACK';
  }

  private nextQuestion() {
    this.currentQuestionIndex += 1;
    this.setupCurrentQuestion();
  }

  // --- Display Text Generator (Even G2 Screen Content) ---
  public getDisplayText(): string {
    switch (this.screenState) {
      case 'HOME':
        return `Vocab Quiz\n\n${this.homeMenuIndex === 0 ? '> New 10' : '  New 10'}\n${this.homeMenuIndex === 1 ? '> Wrong 10' : '  Wrong 10'}`;
      
      case 'NO_WRONG_WORDS':
        return `No wrong words\n\nClick: Home`;

      case 'QUIZ': {
        const q = this.sessionQuestions[this.currentQuestionIndex];
        const progress = this.getSessionProgress();
        const choicesLines = this.shuffledChoices.map((choice, index) => {
          const letter = String.fromCharCode(65 + index); // A, B, C, D
          const isSelected = index === this.quizChoiceIndex;
          return `${isSelected ? '>' : ' '}${letter} ${choice}`;
        }).join('\n');
        
        return `Q${progress}\n${q.word}\n${choicesLines}`;
      }

      case 'FEEDBACK': {
        const q = this.sessionQuestions[this.currentQuestionIndex];
        if (this.lastAnswerWasCorrect) {
          return `Correct\n\nClick: next`;
        } else {
          return `Wrong\nAns: ${q.answer}\n\nClick: next`;
        }
      }

      case 'RESULT': {
        const total = this.sessionQuestions.length;
        if (this.score === total) {
          return `Perfect\n${this.score}/${total}\n\nClick: Home`;
        } else {
          return `Score\n${this.score}/${total}\n\n${this.resultMenuIndex === 0 ? '> Retry wrong' : '  Retry wrong'}\n${this.resultMenuIndex === 1 ? '> Home' : '  Home'}`;
        }
      }
      
      default:
        return '';
    }
  }
}
