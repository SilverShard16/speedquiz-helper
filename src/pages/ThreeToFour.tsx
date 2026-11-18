import { useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
  TextField
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import type { Question } from '../models/Question';
import { importQuestionFile, exportQuestionFiles } from '../services/xmlService';
import VisuallyHiddenInput from '../components/VisuallyHiddenInput';

export default function ThreeToFour() {
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [roundName, setRoundName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);

  useEffect(() => {
    setDownloadReady(questions.length === 60);
  }, [questions]);

  const handleImport = async (
      event: React.ChangeEvent<HTMLInputElement>
  ) => {
      const importedFile = event.currentTarget.files?.[0];

      if (!importedFile || uploadedFiles.length === 3) return;

      setUploadedFiles(prev => [...prev, importedFile.name]);

      setError(null);

      try {
          const importedQuestions = await importQuestionFile(importedFile);
          setQuestions(prev => prev.concat(importedQuestions));
      } catch (err) {
          setError(
              err instanceof Error
                  ? err.message
                  : "Failed to import questions."
          );
      }
  };

  const handleExport = () => {
      try {
          exportQuestionFiles(questions, roundName);
      } catch (err) {
          setError(
              err instanceof Error
                  ? err.message
                  : "Failed to export questions."
          );
      }
  };

  const clearFields = () => {
    setUploadedFiles([]);
    setRoundName("");
    setQuestions([]);
    setError(null);
    setDownloadReady(false);
  };

  return (
    <Stack spacing={4}>
      <Stack spacing={2} alignItems="flex-start">
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: 36, md: 48 } }}
        >
          Three Speedquizzing Rounds to Four
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 600 }}>
          Takes three 20 Question Speedquizzing rounds and slices them into four 15 Question Speedquizzing rounds.
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 600 }}>
          Handy for those who prefer shorter rounds but don't want to waste any questions.
        </Typography>
      </Stack>

      <Card sx={{ maxWidth: 560, width: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1}>
            <Typography variant="h5" component="h2">
              Upload Rounds
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
            {uploadedFiles.map((fileName, index) => (
              <>
                <Divider />
                <Typography key={index} variant="subtitle1" color="text.secondary">
                {fileName}
              </Typography>
            </>
            ))}
            <Divider />
            <Stack direction="row" spacing={3} sx={{ width: '100%', maxWidth: 450, pt: 1 }}>
              <Button
                component="label"
                variant="contained"
                size="small"
                disabled={uploadedFiles.length === 3}
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
                disabled={!downloadReady}
                onClick={handleExport}
              >
                Download Split Rounds
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={clearFields}
              >
                Clear
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
