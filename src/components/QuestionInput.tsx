import {
    Box,
    Button,
    Divider,
    Radio,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisuallyHiddenInput from '../components/VisuallyHiddenInput';
import { type EditorQuestion, type QuestionType, createEmptyQuestion } from "../models/Question";
import { type RoundKind, canUseQuestionType, hasEnteredAnswer } from "../services/roundHelpers";
import { getShortAnswer } from '../services/answerService';
import { fileToBase64 } from '../services/pictureService';

interface QuestionInputProps {
    question: EditorQuestion;
    questionNumber: number;
    roundKind: RoundKind;
    onChange: (question: EditorQuestion) => void;
    onRemove: () => void;
}

export default function QuestionInput({
    question,
    questionNumber,
    roundKind,
    onChange,
    onRemove
}: QuestionInputProps) {

    const canSelectType = (type: QuestionType): boolean => {
        if (!canUseQuestionType(roundKind, type)) {
            return false;
        }

        if (!hasEnteredAnswer(question)) {
            return true;
        }

        return question.type === type;
    };

    const handleTypeChange = (type: QuestionType | null) => {
        if (!type || !canSelectType(type)) {
            return;
        }

        const newQuestion = createEmptyQuestion(type);

        onChange({
            ...newQuestion,
            clientId: question.clientId,
            questionInfo: {
                ...newQuestion.questionInfo,
                id: question.questionInfo.id,
                questionText: question.questionInfo.questionText,
                pictureBaseString: question.questionInfo.pictureBaseString
            }
        });
    };

    const handlePictureUpload = async (file?: File) => {
        if (!file) return;

        const base64 = await fileToBase64(file);

        onChange({
            ...question,
            questionInfo: {
                ...question.questionInfo,
                pictureBaseString: base64.replace(
                    /^data:[^,]+;base64,/i,
                    ""
                ),
                pictureFileName: file.name
            }
        });
    };

    const handlePictureRemove = () => {
        onChange({
            ...question,
            questionInfo: {
                ...question.questionInfo,
                pictureBaseString: "",
                pictureFileName: ""
            }
        });
    };


    
    const handleAnswerChange = (value: string): void => {
        if (question.type === "standard") {
            if (/^\d+$/.test(value)) {
                const numericValue = Number(value);

                if (!Number.isSafeInteger(numericValue)) {
                    return;
                }

                onChange({
                    ...question,
                    type: "numerical",
                    questionInfo: {
                        ...question.questionInfo,
                        userView: "numbers"
                    },
                    answer: {
                        value: numericValue
                    }
                });

                return;
            }

            onChange({
                ...question,
                answer: {
                    ...question.answer,
                    answerText: value,
                    shortAnswer: getShortAnswer(value)
                }
            });

            return;
        }

        if (question.type === "numerical") {
            if (value === "") {
                onChange({
                    ...question,
                    type: "standard",
                    questionInfo: {
                        ...question.questionInfo,
                        userView: "letters"
                    },
                    answer: {
                        answerText: "",
                        shortAnswer: ""
                    }
                });

                return;
            }

            if (!/^\d+$/.test(value)) {
                return;
            }

            const numericValue = Number(value);

            if (!Number.isSafeInteger(numericValue)) {
                return;
            }

            onChange({
                ...question,
                answer: {
                    ...question.answer,
                    value: numericValue
                }
            });
        }
    };



    return (
        <Box
            sx={{
                p: 2,
                border: 1,
                borderColor: "divider",
                borderRadius: 2
            }}
        >
            <Stack spacing={2}>
                <Typography
                    variant="subtitle1"
                    color="text.secondary"
                >
                    Question {questionNumber + 1}
                </Typography>

                <ToggleButtonGroup
                    value={question.type}
                    size="small"
                    exclusive
                    onChange={(_, value: QuestionType | null) =>
                        handleTypeChange(value)
                    }

                    sx={{
                        width: "100%",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 1,

                        "& .MuiToggleButtonGroup-grouped": {
                            flex: "1 1 110px",
                            minWidth: 0,
                            margin: 0,
                            border: 1,
                            borderColor: "divider",
                            borderRadius: "8px",
                            textTransform: "none",
                            whiteSpace: "nowrap",

                            "&:first-of-type, &:last-of-type": {
                                borderRadius: "8px"
                            },

                            "&:not(:first-of-type)": {
                                marginLeft: 0,
                                borderLeft: 1,
                                borderColor: "divider",
                                borderRadius: "8px"
                            },

                            "&.Mui-selected": {
                                bgcolor: "primary.main",
                                color: "primary.contrastText",
                                borderColor: "primary.main",

                                "&:hover": {
                                    bgcolor: "primary.dark",
                                    borderColor: "primary.dark"
                                }
                            },

                            "&:not(:first-of-type).Mui-selected": {
                                borderColor: "primary.main"
                            }
                        }
                    }}
                >
                    <ToggleButton
                        value="standard"
                        disabled={!canSelectType("standard")}
                    >
                        Letters
                    </ToggleButton>

                    <ToggleButton
                        value="multi"
                        disabled={!canSelectType("multi")}
                    >
                        Multiple Choice
                    </ToggleButton>

                    <ToggleButton
                        value="sequence"
                        disabled={!canSelectType("sequence")}
                    >
                        Sequence
                    </ToggleButton>

                    <ToggleButton
                        value="numerical"
                        disabled={!canSelectType("numerical")}
                    >
                        Numbers
                    </ToggleButton>

                    <ToggleButton
                        value="nearest"
                        disabled={!canSelectType("nearest")}
                    >
                        Nearest Win
                    </ToggleButton>
                </ToggleButtonGroup>


                <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ width: "100%" }}
                >
                    <Tooltip
                        title={
                            question.questionInfo.pictureFileName ||
                            "No picture uploaded"
                        }
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            noWrap
                            sx={{
                                flex: 1,
                                minWidth: 0
                            }}
                        >
                            {question.questionInfo.pictureFileName ||
                                (question.questionInfo.pictureBaseString
                                    ? "Picture attached"
                                    : "No picture selected")}
                        </Typography>
                    </Tooltip>

                    <Button
                        component="label"
                        variant="contained"
                        size="small"
                        startIcon={<CloudUploadIcon />}
                        sx={{
                            flexShrink: 0,
                            whiteSpace: "nowrap"
                        }}
                    >
                        Upload Picture

                        <VisuallyHiddenInput
                            type="file"
                            accept="image/*"
                            onChange={event => {
                                const file = event.currentTarget.files?.[0];

                                event.currentTarget.value = "";

                                void handlePictureUpload(file);
                            }}
                        />
                    </Button>

                    <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<DeleteOutlineIcon />}
                        disabled={!question.questionInfo.pictureBaseString}
                        onClick={handlePictureRemove}
                        sx={{ flexShrink: 0 }}
                    >
                        Clear
                    </Button>
                </Stack>

                <TextField
                    label="Question"
                    multiline
                    minRows={2}
                    fullWidth
                    value={question.questionInfo.questionText}
                    onChange={event =>
                        onChange({
                            ...question,
                            questionInfo: {
                                ...question.questionInfo,
                                questionText: event.target.value
                            }
                        })
                    }
                />

                <Divider />

                
                {(question.type === "standard" ||
                    question.type === "numerical") && (
                    <TextField
                        label="Answer"
                        fullWidth
                        type="text"
                        value={
                            question.type === "numerical"
                                ? question.answer.value ?? ""
                                : question.answer.answerText
                        }
                        onChange={(event) =>
                            handleAnswerChange(event.target.value)
                        }
                        slotProps={{
                            htmlInput: {
                                inputMode:
                                    question.type === "numerical"
                                        ? "numeric"
                                        : "text"
                            }
                        }}
                    />
                )}

                {question.type === "multi" && (
                    <Stack spacing={1}>
                        <Typography variant="subtitle2">
                            Answer Options
                        </Typography>

                        {question.answers.answerOptions.map(
                            (option, optionIndex) => (
                                <Stack
                                    key={optionIndex}
                                    direction="row"
                                    alignItems="center"
                                    spacing={1}
                                >
                                    <Radio
                                        checked={option.correct}
                                        onChange={() =>
                                            onChange({
                                                ...question,
                                                answers: {
                                                    answerOptions:
                                                        question.answers.answerOptions.map(
                                                            (current, i) => ({
                                                                ...current,
                                                                correct: i === optionIndex
                                                            })
                                                        )
                                                }
                                            })
                                        }
                                    />

                                    <TextField
                                        size="small"
                                        fullWidth
                                        label={`Option ${optionIndex + 1}`}
                                        value={option.optionText}
                                        onChange={event =>
                                            onChange({
                                                ...question,
                                                answers: {
                                                    answerOptions:
                                                        question.answers.answerOptions.map(
                                                            (current, i) =>
                                                                i === optionIndex
                                                                    ? {
                                                                        ...current,
                                                                        optionText: event.target.value
                                                                    }
                                                                    : current
                                                        )
                                                }
                                            })
                                        }
                                    />
                                </Stack>
                            )
                        )}
                    </Stack>
                )}

                {question.type === "sequence" && (
                    <Stack spacing={1}>
                        <Typography variant="subtitle2">
                            Correct Sequence
                        </Typography>

                        {question.answer.optionsInOrder.map(
                            (option, optionIndex) => (
                                <Stack
                                    key={optionIndex}
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                >
                                    <Typography>
                                        {optionIndex + 1}.
                                    </Typography>

                                    <TextField
                                        size="small"
                                        fullWidth
                                        value={option}
                                        onChange={event =>
                                            onChange({
                                                ...question,
                                                answer: {
                                                    optionsInOrder:
                                                        question.answer.optionsInOrder.map(
                                                            (current, i) =>
                                                                i === optionIndex
                                                                    ? event.target.value
                                                                    : current
                                                        )
                                                }
                                            })
                                        }
                                    />

                                    <Button
                                        color="error"
                                        onClick={() =>
                                            onChange({
                                                ...question,
                                                answer: {
                                                    optionsInOrder:
                                                        question.answer.optionsInOrder.filter(
                                                            (_, i) => i !== optionIndex
                                                        )
                                                }
                                            })
                                        }
                                    >
                                        Remove
                                    </Button>
                                </Stack>
                            )
                        )}

                        <Button
                            onClick={() =>
                                onChange({
                                    ...question,
                                    answer: {
                                        optionsInOrder: [
                                            ...question.answer.optionsInOrder,
                                            ""
                                        ]
                                    }
                                })
                            }
                        >
                            + Add Step
                        </Button>
                    </Stack>
                )}

                {(question.type === "nearest") && (
                    <TextField
                        type="number"
                        fullWidth
                        label="Target Value"
                        value={question.answer.value ?? ""}
                        inputProps={{
                            inputMode: "numeric",
                            pattern: "[0-9]*"
                        }}
                        onChange={event => {
                            const rawValue = event.target.value;

                            onChange({
                                ...question,
                                answer: {
                                    value: rawValue === ""
                                        ? null
                                        : Number(rawValue)
                                }
                            });
                        }}
                    />
                )}

                <Button
                    color="error"
                    variant="text"
                    sx={{ alignSelf: "flex-end" }}
                    onClick={onRemove}
                >
                    Remove Question
                </Button>
            </Stack>
        </Box>
    );
}
