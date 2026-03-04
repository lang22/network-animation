import React from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';

const TimelineContainer = styled.div`
    background: ${darkTheme.colors.surface};
    border-radius: 12px;
    border: 1px solid ${darkTheme.colors.border};
    padding: 16px;
`;

const TimelineHeader = styled.h4`
    margin: 0 0 16px 0;
    font-size: 13px;
    font-weight: 600;
    color: ${darkTheme.colors.text};
    display: flex;
    align-items: center;
    gap: 8px;
`;

const StepsContainer = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 12px 0;
`;

const Step = styled.div<{ $active?: boolean; $completed?: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 1;
    position: relative;

    &:not(:last-child)::after {
        content: '';
        position: absolute;
        top: 12px;
        left: 50%;
        width: 100%;
        height: 2px;
        background: ${({ $completed }) =>
            $completed ? darkTheme.colors.primary : darkTheme.colors.border};
        z-index: 0;
    }
`;

const StepDot = styled.div<{ $active?: boolean; $completed?: boolean }>`
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: ${({ $active, $completed }) =>
        $active ? darkTheme.colors.primary :
            $completed ? darkTheme.colors.success :
                darkTheme.colors.surfaceLight};
    border: 2px solid ${({ $active, $completed }) =>
        $active ? darkTheme.colors.primary :
            $completed ? darkTheme.colors.success :
                darkTheme.colors.border};
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    transition: all 0.3s ease;
    box-shadow: ${({ $active }) =>
        $active ? `0 0 15px ${darkTheme.colors.glow}` : 'none'};
`;

const StepIcon = styled.span`
    font-size: 10px;
    color: white;
`;

const StepLabel = styled.span<{ $active?: boolean; $completed?: boolean }>`
    font-size: 10px;
    font-weight: 500;
    color: ${({ $active, $completed }) =>
        $active ? darkTheme.colors.primary :
            $completed ? darkTheme.colors.success :
                darkTheme.colors.textMuted};
    text-align: center;
    white-space: nowrap;
`;

const StepDescription = styled.span`
    font-size: 9px;
    color: ${darkTheme.colors.textMuted};
    text-align: center;
`;

interface TimelineStep {
    id: string;
    label: string;
    description?: string;
    completed: boolean;
    active: boolean;
}

interface TimelinePanelProps {
    title: string;
    steps: TimelineStep[];
}

const TimelinePanel: React.FC<TimelinePanelProps> = ({ title, steps }) => {
    return (
        <TimelineContainer>
            <TimelineHeader>
                ⏱️ {title}
            </TimelineHeader>
            <StepsContainer>
                {steps.map((step, index) => (
                    <Step
                        key={step.id}
                        $active={step.active}
                        $completed={step.completed}
                    >
                        <StepDot
                            $active={step.active}
                            $completed={step.completed}
                        >
                            {step.completed ? (
                                <StepIcon>✓</StepIcon>
                            ) : step.active ? (
                                <StepIcon>●</StepIcon>
                            ) : null}
                        </StepDot>
                        <StepLabel
                            $active={step.active}
                            $completed={step.completed}
                        >
                            {step.label}
                        </StepLabel>
                        {step.description && (
                            <StepDescription>{step.description}</StepDescription>
                        )}
                    </Step>
                ))}
            </StepsContainer>
        </TimelineContainer>
    );
};

export default TimelinePanel;