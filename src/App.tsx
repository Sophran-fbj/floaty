import { NoteWindow } from "@/pages/NoteWindow";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

function App() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: 14,
          color: "#999",
        }}
      >
        无效的便签窗口
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <NoteWindow noteId={id} />
    </ErrorBoundary>
  );
}

export default App;
