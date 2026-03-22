'use client';

export default function IdeasPage() {
  return (
    <div className="ideas-page">
      <div className="ideas-header">
        <h1 className="page-title">Предложить идею</h1>
        <p className="ideas-subtitle">Помогите нам стать лучше — предложите функцию или улучшение</p>
      </div>

      <div className="ideas-widget-container">
        {/* @ts-expect-error — custom web component from Involveo */}
        <involveo-widget-embed />
      </div>
    </div>
  );
}
