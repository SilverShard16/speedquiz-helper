import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import type { Question } from '../models/Question';
import { importQuestionFile, exportSingleRound } from '../services/xmlService';
import { convertQuestionsToLastLetter } from '../services/answerService';
import VisuallyHiddenInput from '../components/VisuallyHiddenInput';

export default function RoundToLastLetter() {
  const [uploadedFile, setUploadedFile] = useState<string>("");
  const [roundName, setRoundName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const importedFile = event.currentTarget.files?.[0];
  
        if (!importedFile) return;
  
        setUploadedFile(importedFile.name);
  
        setError(null);
  
        try {
            const importedQuestions = await importQuestionFile(importedFile);
            setQuestions(importedQuestions);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to import questions."
            );
        }
    };

    const handleExport = async () => {
      try {
          if(questions.every((question) => question.type === "standard")) {
            const reversedQuestions = await convertQuestionsToLastLetter(questions);
            exportSingleRound(reversedQuestions, roundName);
          } else {
            throw new Error(
              "Not all questions are letter questions"
            );
          }          
      } catch (err) {
          setError(
              err instanceof Error
                  ? err.message
                  : "Failed to export questions."
          );
      }
  };

  return (
    <Stack spacing={4}>
      <Stack spacing={2} alignItems="flex-start">
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: 36, md: 48 } }}
        >
          Convert Speedquizzing Round to Last Letter Round
        </Typography>
        <Typography color="text.primary" sx={{ maxWidth: 600 }}>
          Converts a normal Speedquizzing round to the same round where the last letter is the correct answer
        </Typography>
        <Alert
          severity="info"
          variant="outlined"
          sx={{ maxWidth: 560, borderRadius: 2 }}
        >
          All questions must be letter questions. No multiple choice, sequence, numbers etc.
        </Alert>
      </Stack>

      <Card sx={{ maxWidth: 560, width: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1}>
            <Typography variant="h5" component="h2">
              Upload Round
            </Typography>
            <Divider />
            <TextField
              id="outlined"
              label="Round Name (optional)"
              variant="outlined"
              size="small"
              value={roundName}
              onChange={(event) => setRoundName(event.target.value)}
            />
            <Divider />
            <Typography color="text.primary" sx={{ maxWidth: 600 }}>
              {uploadedFile}
            </Typography>
            <Stack direction="row" spacing={3} sx={{ width: '100%', maxWidth: 450, pt: 1 }}>
              <Button
                component="label"
                variant="contained"
                size="small"
                startIcon={<CloudUploadIcon />}
                sx={{
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Upload Round
                <VisuallyHiddenInput
                  type="file"
                  accept=".sqq"
                  onChange={(event) => {
                        handleImport(event);
                        event.currentTarget.value = '';
                      }}
                />
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={questions.length === 0}
                onClick={handleExport}
              >
                Download Last Letter Round
              </Button>
            </Stack>
              {error && 
              <>
                <Divider />
                <Alert
                severity="error"
                variant="outlined"
                sx={{ maxWidth: 560, borderRadius: 2 }}
                >
                  {error}
                </Alert>
              </>}
          </Stack>
        </CardContent>
      </Card>
  </Stack>
  );
}
