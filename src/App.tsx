import { useEffect, useState } from 'react';
import type { CivicsTopic, LessonMaterials, LessonPlan } from './types';
import {
  createEmptyLessonPlan,
  deleteLessonPlan,
  duplicateLessonPlan,
  listLessonPlans,
  saveLessonPlan,
} from './lib/storage';
import { buildLessonPrompt } from './lib/promptBuilder';
import { parseAiResponse } from './lib/responseParser';
import { Library } from './components/Library';
import { TopicPicker } from './components/TopicPicker';
import { MaterialsInput } from './components/MaterialsInput';
import { PromptPanel } from './components/PromptPanel';
import { ResponseImport } from './components/ResponseImport';
import { LessonEditor } from './components/LessonEditor';
import { PrintPreview } from './components/PrintPreview';

type View = 'library' | 'build' | 'edit' | 'preview';
type BuildStep = 1 | 2 | 3 | 4;

export default function App() {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [view, setView] = useState<View>('library');
  const [buildStep, setBuildStep] = useState<BuildStep>(1);
  const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);
  const [goalsHint, setGoalsHint] = useState('');
  const [skillsHint, setSkillsHint] = useState('');
  const [aiResponse, setAiResponse] = useState('');

  useEffect(() => {
    setPlans(listLessonPlans());
  }, []);

  function refreshPlans() {
    setPlans(listLessonPlans());
  }

  function handleCreate() {
    const plan = createEmptyLessonPlan();
    setActivePlan(plan);
    setGoalsHint('');
    setSkillsHint('');
    setAiResponse('');
    setBuildStep(1);
    setView('build');
  }

  function handleOpen(id: string) {
    const plan = plans.find((p) => p.id === id) ?? null;
    setActivePlan(plan);
    setAiResponse(plan?.rawAiResponse ?? '');
    setView('edit');
  }

  function handleDelete(id: string) {
    deleteLessonPlan(id);
    refreshPlans();
  }

  function handleDuplicate(id: string) {
    duplicateLessonPlan(id);
    refreshPlans();
  }

  function handleSelectTopic(topic: CivicsTopic) {
    if (!activePlan) return;
    setActivePlan({ ...activePlan, topicId: topic.id, topicTitle: topic.title, title: `שיעור: ${topic.title}` });
    setGoalsHint(topic.suggestedGoals.join('\n'));
    setSkillsHint(topic.suggestedSkills.join('\n'));
  }

  function handleCustomTitleChange(title: string) {
    if (!activePlan) return;
    setActivePlan({ ...activePlan, topicId: null, topicTitle: title, title: title ? `שיעור: ${title}` : activePlan.title });
  }

  function handleMaterialsChange(materials: LessonMaterials) {
    if (!activePlan) return;
    setActivePlan({ ...activePlan, materials });
  }

  function handleParseResponse() {
    if (!activePlan) return;
    const parsed = parseAiResponse(aiResponse);
    const updated: LessonPlan = {
      ...activePlan,
      rawAiResponse: aiResponse,
      content: { ...activePlan.content, ...parsed },
    };
    setActivePlan(updated);
    saveLessonPlan(updated);
    refreshPlans();
    setView('edit');
  }

  function handleSaveAndClose() {
    if (!activePlan) return;
    saveLessonPlan(activePlan);
    refreshPlans();
    setView('library');
    setActivePlan(null);
  }

  const prompt = activePlan
    ? buildLessonPrompt({
        topicTitle: activePlan.topicTitle || 'נושא לבחירת המורה',
        goalsHint,
        skillsHint,
        materials: activePlan.materials,
      })
    : '';

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>בונה מערכי שיעור באזרחות</h1>
        {view !== 'library' && (
          <button
            className="btn no-print"
            onClick={() => {
              setView('library');
              setActivePlan(null);
            }}
          >
            → חזרה לספרייה
          </button>
        )}
      </header>

      {view === 'library' && (
        <Library
          plans={plans}
          onOpen={handleOpen}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}

      {view === 'build' && activePlan && (
        <div>
          <div className="step-indicator no-print">
            {[1, 2, 3, 4].map((step) => (
              <span key={step} className={`step${step === buildStep ? ' active' : step < buildStep ? ' done' : ''}`}>
                שלב {step}
              </span>
            ))}
          </div>

          {buildStep === 1 && (
            <>
              <TopicPicker
                selectedTopicId={activePlan.topicId}
                customTitle={activePlan.topicId ? '' : activePlan.topicTitle}
                onSelectTopic={handleSelectTopic}
                onCustomTitleChange={handleCustomTitleChange}
              />
              <div className="toolbar">
                <button
                  className="btn btn-primary"
                  disabled={!activePlan.topicTitle.trim()}
                  onClick={() => setBuildStep(2)}
                >
                  המשך
                </button>
              </div>
            </>
          )}

          {buildStep === 2 && (
            <>
              <MaterialsInput
                materials={activePlan.materials}
                onChange={handleMaterialsChange}
                goalsHint={goalsHint}
                skillsHint={skillsHint}
                onGoalsHintChange={setGoalsHint}
                onSkillsHintChange={setSkillsHint}
              />
              <div className="toolbar">
                <button className="btn" onClick={() => setBuildStep(1)}>
                  חזרה
                </button>
                <button className="btn btn-primary" onClick={() => setBuildStep(3)}>
                  יצירת הפרומפט
                </button>
              </div>
            </>
          )}

          {buildStep === 3 && (
            <>
              <PromptPanel prompt={prompt} />
              <div className="toolbar">
                <button className="btn" onClick={() => setBuildStep(2)}>
                  חזרה
                </button>
                <button className="btn btn-primary" onClick={() => setBuildStep(4)}>
                  יש לי תשובה מה-AI
                </button>
              </div>
            </>
          )}

          {buildStep === 4 && (
            <>
              <ResponseImport value={aiResponse} onChange={setAiResponse} onParse={handleParseResponse} />
              <div className="toolbar">
                <button className="btn" onClick={() => setBuildStep(3)}>
                  חזרה
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {view === 'edit' && activePlan && (
        <div>
          <LessonEditor plan={activePlan} onChange={setActivePlan} />
          <div className="toolbar">
            <button className="btn" onClick={() => setView('preview')}>
              תצוגה להדפסה
            </button>
            <button className="btn btn-primary" onClick={handleSaveAndClose}>
              שמירה וסגירה
            </button>
          </div>
        </div>
      )}

      {view === 'preview' && activePlan && (
        <div>
          <PrintPreview plan={activePlan} />
          <div className="toolbar no-print">
            <button className="btn" onClick={() => setView('edit')}>
              חזרה לעריכה
            </button>
            <button className="btn btn-primary" onClick={handleSaveAndClose}>
              שמירה וסגירה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
