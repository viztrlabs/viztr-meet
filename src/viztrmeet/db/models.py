"""
Database models for VizTR Meet.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Integer, Text, Enum as SQLEnum, Index, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum


class Base(DeclarativeBase):
    pass


class RoomStatus(str, enum.Enum):
    ACTIVE = "active"
    ENDED = "ended"
    ARCHIVED = "archived"


class ParticipantStatus(str, enum.Enum):
    JOINED = "joined"
    LEFT = "left"
    DISCONNECTED = "disconnected"


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    livekit_sid: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[RoomStatus] = mapped_column(SQLEnum(RoomStatus), default=RoomStatus.ACTIVE, index=True)
    max_participants: Mapped[int] = mapped_column(Integer, default=10)
    source_lang: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    target_lang: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    participants = relationship("Participant", back_populates="room", cascade="all, delete-orphan")
    translations = relationship("Translation", back_populates="room", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_rooms_status_created", "status", "created_at"),
    )


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), index=True)
    identity: Mapped[str] = mapped_column(String(255))
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    livekit_sid: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[ParticipantStatus] = mapped_column(SQLEnum(ParticipantStatus), default=ParticipantStatus.JOINED, index=True)
    source_lang: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    target_lang: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    metadata: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    room = relationship("Room", back_populates="participants")
    transcripts = relationship("Transcript", back_populates="participant", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_participants_room_status", "room_id", "status"),
    )


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), index=True)
    participant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("participants.id"), index=True)
    source_text: Mapped[str] = mapped_column(Text)
    source_lang: Mapped[str] = mapped_column(String(10))
    translated_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_lang: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    asr_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    translation_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    room = relationship("Room", back_populates="translations")
    participant = relationship("Participant", back_populates="transcripts")

    __table_args__ = (
        Index("ix_transcripts_room_created", "room_id", "created_at"),
        Index("ix_transcripts_participant_created", "participant_id", "created_at"),
    )


class AudioChunk(Base):
    __tablename__ = "audio_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), index=True)
    participant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("participants.id"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    vad_detected: Mapped[bool] = mapped_column(default=False)
    noise_filtered: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_audio_chunks_room_participant", "room_id", "participant_id", "chunk_index"),
    )