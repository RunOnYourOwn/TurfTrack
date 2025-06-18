from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductRead
from typing import List

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=List[ProductRead])
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product))
    return result.scalars().all()


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(product_in: ProductCreate, db: AsyncSession = Depends(get_db)):
    db_product = Product(**product_in.dict(exclude_unset=True))
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product


@router.put("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: int, update: ProductUpdate, db: AsyncSession = Depends(get_db)
):
    db_product = await db.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in update.dict(exclude_unset=True).items():
        setattr(db_product, field, value)
    await db.commit()
    await db.refresh(db_product)
    return db_product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    db_product = await db.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(db_product)
    await db.commit()
