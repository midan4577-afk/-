import { CIVICS_TOPICS } from '../data/topics';
import type { CivicsTopic } from '../types';

interface Props {
  selectedTopicId: string | null;
  customTitle: string;
  onSelectTopic: (topic: CivicsTopic) => void;
  onCustomTitleChange: (title: string) => void;
}

export function TopicPicker({ selectedTopicId, customTitle, onSelectTopic, onCustomTitleChange }: Props) {
  return (
    <div className="card">
      <h2>1. בחירת נושא</h2>
      <div className="topic-grid">
        {CIVICS_TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            className={`topic-card${selectedTopicId === topic.id ? ' selected' : ''}`}
            onClick={() => onSelectTopic(topic)}
          >
            <strong>{topic.title}</strong>
            <p>{topic.description}</p>
          </button>
        ))}
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="custom-topic">או נושא מותאם אישית</label>
        <input
          id="custom-topic"
          type="text"
          value={customTitle}
          onChange={(e) => onCustomTitleChange(e.target.value)}
          placeholder="לדוגמה: משבר חוקתי והפרדת רשויות בעת חירום"
        />
      </div>
    </div>
  );
}
