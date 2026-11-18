import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography,
  TextField,
  Switch,
  FormGroup,
  FormControlLabel,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import type { Answer } from '../models/AnswerModels';
import type { Question } from '../models/Question';
import { fileToBase64 } from '../services/pictureService';
import { getShortAnswer } from '../services/answerService';
import { downloadQuestionsXml } from '../services/xmlService';
import VisuallyHiddenInput from '../components/VisuallyHiddenInput';

export default function AnswerList() {
  const [count, setCount] = useState(0);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isPictureRound, setIsPictureRound] = useState(false);
  const [showPictureInput, setShowPictureInput] = useState(false);
  const [disableInput, setDisableInput] = useState(false);

  const updateAnswers = (event) => {
    const input = event.target.value;
    const split = input.split("\n");
    const mapped = split.map((answerText) => ({
      answerText: answerText.trim(),
      shortAnswer: getShortAnswer(answerText),
      pictureFileName: "",
      pictureBaseString: "",
    }));
    setAnswers(mapped);
  };

  const updateQuestionText = (event) => {
    const input = event.target.value;
    setQuestion(input);
  };

  const checkAndUpdateAnswers = (newAnswers) => {
    let mappedAnswers = [];
    for(let i = 0; i < newAnswers.length; i++) {
      if(answers[i].answerText !== newAnswers[i]) {
        mappedAnswers.push({
          answerText: newAnswers[i].trim(),
          shortAnswer: getShortAnswer(newAnswers[i].trim()),
          pictureFileName: "",
          pictureBaseString: "",
        });
      } else {
        mappedAnswers.push(answers[i]);
      }
    }

    return mappedAnswers;
  };

  const updateSetAnswers = (newAnswers: Answer[]) => {
    setAnswers(newAnswers);
  };

  const uploadPicture = async (file, index) => {
    if (!file) return;

    const baseString = await fileToBase64(file);

    setAnswers(prev =>
      prev.map((answer, i) =>
        i === index
          ? {
            ...answer,
            pictureFileName: file.name,
            pictureBaseString: baseString
          }
          : answer
        )
    );
  };

  const removePicture = (index) => {
    setAnswers(prev =>
        prev.map((answer, i) =>
            i === index
                ? {
                    ...answer,
                    pictureFileName: "",
                    pictureBaseString: ""
                }
                : answer
        )
    );
  };

  const setPictureRound = (newBool: boolean) => {
    if(!newBool && showPictureInput) {
      setShowPictureInput(false);
    }
    setIsPictureRound(newBool)
  };

  const allPicturesAssigned = () => {
    return answers.filter((answer) => answer.pictureBaseString === "").length === 0;
  };

  const createQuestionsArray = () => {
    let questionArray: Question[] = [];

    console.log(question);

    for(let i = 0; i < answers.length; i++) {
      let qInfo = {
        id: (i + 1),
        userView: "letters",
        questionText: question,
        pictureBaseString: (isPictureRound ? answers[i].pictureBaseString : ""),
      };

      let answerInfo = {
        answerText: answers[i].answerText,
        shortAnswer: answers[i].shortAnswer,
      }

      questionArray.push({
        questionInfo: qInfo,
        answer: answerInfo
      });
    }

    return questionArray;
  };

  const createRound = async () => {
    const questions = await createQuestionsArray();
    await downloadQuestionsXml(questions, "questions");
  };

  const clearFields = () => {
    setCount(0);
    setQuestion("");
    setAnswers([]);
    setIsPictureRound(false);
    setShowPictureInput(false);
    setDisableInput(false);
  };

  return (
    <Stack spacing={4}>
      <Stack spacing={2} alignItems="flex-start">
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: 36, md: 48 } }}
        >
          Answer List to Speedquizzing Round
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 600 }}>
          Create a round where every question is the same, only the answers change.
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 600 }}>
          Supports picture and non-picture rounds
        </Typography>
        <Alert
          severity="info"
          variant="outlined"
          sx={{ maxWidth: 560, borderRadius: 2 }}
        >
          Add line breaks (press Enter) between answers.
        </Alert>
      </Stack>

      <Card sx={{ maxWidth: 560, width: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={11} alignItems="center">
              <Typography variant="h5" component="h2">
                Question and Answers
              </Typography>
              <FormGroup>
                <FormControlLabel control={<Switch checked={isPictureRound} onChange={(event) => setIsPictureRound(event.target.checked)} />} label="Picture Round" sx={{color: 'text.secondary'}} />
              </FormGroup>
            </Stack>
            <TextField
              required
              id="outlined-required"
              label="Question"
              variant="filled"
              value={question}
              onChange={updateQuestionText}
              disabled={showPictureInput}
            />

            <TextField
                id="standard-multiline-flexible"
                label="Answers"
                required
                multiline
                maxRows={4}
                variant="filled"
                value={answers.map(answer => answer.answerText).join("\n")}
                onChange={updateAnswers}
                disabled={showPictureInput}
              />

              <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', maxWidth: 450, pt: 1 }}>                
              {isPictureRound ?
              <Button
                variant="contained"
                size="small"
                disabled={showPictureInput}
                onClick={() => setShowPictureInput(true)}
              >
                Next
              </Button> :
              <Button
                variant="contained"
                size="small"
                onClick={createRound}
              >
                Create
              </Button>
              }
              <Button
                variant="outlined"
                size="small"
                onClick={clearFields}
              >
                Clear
              </Button>
              </Stack>
          </Stack>
        </CardContent>
      </Card>

{isPictureRound && showPictureInput && (
      <Card sx={{ maxWidth: 560, width: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1}>
            <Typography variant="h5" component="h2">
              Now add your pictures
            </Typography>
            <Stack sx={{ width: '100%', maxWidth: 450 }}>
            {answers.map((answer, index) => (
              <Box
                key={index}
                sx={{
                  py: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography
                    noWrap
                    sx={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {answer.answerText}
                  </Typography>
                  <Typography
                    noWrap
                    sx={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {answer.pictureFileName}
                  </Typography>

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
                    Upload file
                    <VisuallyHiddenInput
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        uploadPicture(file, index);
                        event.currentTarget.value = '';
                      }}
                    />
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={answer.pictureFileName === ""}
                    onClick={() => removePicture(index)}
                  >
                    Clear
                  </Button>
                </Stack>
              </Box>
            ))}
            <Stack direction="row" spacing={2} alignItems="center" sx={{mt: 2}}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowPictureInput(false)}
              >
                Go Back
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={!allPicturesAssigned()}
                onClick={createRound}
              >
                Create Speedquizzing Round
              </Button>
            </Stack>
          </Stack>
          </Stack>
        </CardContent>
      </Card>)}      
    </Stack>
  );
}
