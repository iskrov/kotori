from typing import Any
from typing import Generic
from typing import TypeVar

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base service with basic CRUD operations
    """

    def __init__(self, model: type[ModelType]):
        self.model = model

    def get(self, db: Session, id: Any) -> ModelType | None:
        """Get a record by id"""
        return db.query(self.model).filter(self.model.id == id).first()

    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> list[ModelType]:
        """Get multiple records"""
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record"""
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data)  # type: ignore
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | dict[str, Any],
    ) -> ModelType:
        """Update a record without encoding model bytes (avoids utf-8 decode of binary fields)."""
        if isinstance(obj_in, dict):
            update_data: dict[str, Any] = obj_in
        else:
            # Support Pydantic v2 (model_dump) and v1 (dict)
            update_data = (
                obj_in.model_dump(exclude_unset=True)  # type: ignore[attr-defined]
                if hasattr(obj_in, "model_dump")
                else obj_in.dict(exclude_unset=True)  # type: ignore[attr-defined]
            )

        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: Any) -> ModelType:
        """Delete a record"""
        obj = db.get(self.model, id)
        db.delete(obj)
        db.commit()
        return obj
